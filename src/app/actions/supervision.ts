"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStudent, requireUser } from "@/lib/auth";
import { ACADEMIC_YEAR, campaignsFor, loadYearPlan, workLabel } from "@/lib/campaigns";

export type SupState = { error?: string; ok?: boolean; info?: string } | undefined;

const acceptedIn = (supervisorId: string, campaignId: number) =>
  db.supervisorRequest.count({ where: { supervisorId, campaignId, status: "ACCEPTED", enrollment: { status: "ACTIVE" } } });

// ---------- студент ----------

export async function sendSupervisorRequest(_: SupState, form: FormData): Promise<SupState> {
  const user = await requireStudent();
  const e = await db.enrollment.findFirstOrThrow({ where: { id: user.enrollment.id, personId: user.id } });
  const p = z.object({
    campaignId: z.coerce.number().int(),
    supervisorId: z.string().min(1),
    topic: z.string().trim().min(3, "Тема — от 3 символов").max(200),
    message: z.string().trim().min(10, "Сообщение — от 10 символов").max(1000),
  }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };

  // кампания должна быть кампанией этого студента, срок — не прошёл
  const camp = (await campaignsFor(db, e)).find((c) => c.id === p.data.campaignId);
  if (!camp) return { error: "Эта кампания вас не касается" };
  if (camp.workType === "THESIS" && e.supervisorId) return { error: "Руководитель выпускной работы уже закреплён" };
  if (await db.supervisorRequest.findFirst({ where: { enrollmentId: e.id, campaignId: camp.id, status: { in: ["PENDING", "ACCEPTED"] } } }))
    return { error: "По этой работе у вас уже есть заявка. Отзовите её, чтобы написать другому руководителю." };
  // руководитель открыл приём в этой кампании, места остались
  const intake = await db.supervisorIntake.findUnique({ where: { supervisorId_campaignId: { supervisorId: p.data.supervisorId, campaignId: camp.id } } });
  if (!intake) return { error: "Руководитель ещё не открыл приём" };
  if ((await acceptedIn(intake.supervisorId, camp.id)) >= intake.slots) return { error: "У руководителя не осталось мест" };

  await db.$transaction([
    db.supervisorRequest.create({ data: { enrollmentId: e.id, supervisorId: intake.supervisorId, campaignId: camp.id, topic: p.data.topic, message: p.data.message } }),
    db.notification.create({ data: { personId: intake.supervisorId, type: "thesis", title: "Новая заявка на научное руководство", body: `${user.lastName} ${user.firstName} · ${workLabel(camp.workType, camp.level).toLowerCase()}: «${p.data.topic}»`, link: "/staff/supervision" } }),
  ]);
  revalidatePath("/supervisor");
  return { ok: true };
}

export async function withdrawSupervisorRequest(form: FormData) {
  const user = await requireStudent();
  const id = String(form.get("id") ?? "");
  await db.supervisorRequest.updateMany({ where: { id, status: "PENDING", enrollment: { personId: user.id } }, data: { status: "WITHDRAWN", decidedAt: new Date() } });
  revalidatePath("/supervisor");
}

// ---------- руководитель ----------

async function ownCampaign(user: { id: string }, campaignId: number) {
  const me = await db.person.findUniqueOrThrow({ where: { id: user.id }, include: { staffDepartment: true, supervisorProfile: true } });
  const c = await db.supervisionCampaign.findFirst({ where: { id: campaignId, facultyId: me.staffDepartment?.facultyId ?? -1 } });
  if (!c || !me.supervisorProfile?.levels.includes(c.level)) return null;
  return c;
}

export async function openIntake(_: SupState, form: FormData): Promise<SupState> {
  const user = await requireUser(["SUPERVISOR"]);
  const p = z.object({ campaignId: z.coerce.number().int(), slots: z.coerce.number().int().min(1, "Мест — от 1").max(15) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const c = await ownCampaign(user, p.data.campaignId);
  if (!c) return { error: "Кампания не найдена" };
  const taken = await acceptedIn(user.id, c.id);
  if (p.data.slots < taken) return { error: `Уже принято ${taken} — мест не может быть меньше` };
  await db.supervisorIntake.upsert({ where: { supervisorId_campaignId: { supervisorId: user.id, campaignId: c.id } }, create: { supervisorId: user.id, campaignId: c.id, slots: p.data.slots }, update: { slots: p.data.slots } });
  revalidatePath("/staff/supervision");
  return { ok: true, info: "Приём открыт — студенты видят вас в списке" };
}

export async function closeIntake(form: FormData) {
  const user = await requireUser(["SUPERVISOR"]);
  const campaignId = Number(form.get("campaignId"));
  // закрытие не отменяет уже принятых студентов — просто новые заявки больше не приходят
  await db.supervisorIntake.deleteMany({ where: { supervisorId: user.id, campaignId } });
  revalidatePath("/staff/supervision");
}

export async function decideSupervisorRequest(_: SupState, form: FormData): Promise<SupState> {
  const user = await requireUser(["SUPERVISOR"]);
  const id = String(form.get("id") ?? "");
  const decision = String(form.get("decision") ?? "");
  const reply = z.string().trim().max(500).parse(String(form.get("reply") ?? ""));
  const r = await db.supervisorRequest.findFirst({ where: { id, supervisorId: user.id, status: "PENDING" }, include: { campaign: true, enrollment: { include: { thesis: true } } } });
  if (!r) return { error: "Заявка уже обработана" };
  const what = r.campaign ? workLabel(r.campaign.workType, r.campaign.level).toLowerCase() : "работа";

  if (decision === "decline") {
    if (reply.length < 3) return { error: "Напишите студенту причину отказа" };
    await db.$transaction([
      db.supervisorRequest.update({ where: { id }, data: { status: "DECLINED", reply, decidedAt: new Date() } }),
      db.notification.create({ data: { personId: r.enrollment.personId, type: "thesis", title: "Руководитель отклонил заявку", body: `${what}: ${reply}`, link: "/supervisor" } }),
    ]);
  } else if (decision === "accept") {
    if (r.campaignId) {
      const intake = await db.supervisorIntake.findUnique({ where: { supervisorId_campaignId: { supervisorId: user.id, campaignId: r.campaignId } } });
      if (intake && (await acceptedIn(user.id, r.campaignId)) >= intake.slots) return { error: "Места в этой кампании закончились — увеличьте число мест или откажите" };
    }
    const thesis = !r.campaign || r.campaign.workType === "THESIS";
    if (thesis && r.enrollment.supervisorId) return { error: "У студента уже есть руководитель выпускной работы" };
    const ops = [
      db.supervisorRequest.update({ where: { id }, data: { status: "ACCEPTED", reply: reply || null, decidedAt: new Date() } }),
      db.supervisorRequest.updateMany({ where: { enrollmentId: r.enrollmentId, campaignId: r.campaignId, status: "PENDING", id: { not: id } }, data: { status: "WITHDRAWN", decidedAt: new Date() } }),
      db.notification.create({ data: { personId: r.enrollment.personId, type: "thesis", title: "Руководитель согласился!", body: `${user.lastName} ${user.firstName} — ваш руководитель (${what}).${thesis ? ` Тема «${r.topic}» ушла на утверждение кафедре.` : ""}${reply ? ` Комментарий: ${reply}` : ""}`, link: "/supervisor" } }),
    ];
    if (thesis) {
      ops.push(db.enrollment.update({ where: { id: r.enrollmentId }, data: { supervisorId: user.id } }) as never);
      ops.push((r.enrollment.thesis
        ? db.thesis.update({ where: { id: r.enrollment.thesis.id }, data: { topic: r.topic, topicStatus: "PENDING", stage: 2 } })
        : db.thesis.create({ data: { enrollmentId: r.enrollmentId, departmentId: user.staffDepartmentId!, topic: r.topic, topicStatus: "PENDING", stage: 2 } })) as never);
    }
    await db.$transaction(ops);
  } else return { error: "Неизвестное решение" };
  revalidatePath("/staff/supervision");
  revalidatePath("/staff/students");
  return { ok: true };
}

// ---------- деканат ----------

export async function loadPlan(prev: SupState): Promise<SupState> {
  void prev; // сигнатура useActionState
  const user = await requireUser(["DEAN_OFFICE"]);
  if (user.staffFacultyId == null) return { error: "Нет привязки к факультету" };
  const r = await loadYearPlan(db, user.staffFacultyId);
  revalidatePath("/staff/plan");
  return r.created ? { ok: true, info: `Учебный план ${ACADEMIC_YEAR} загружен: кампаний ${r.created}, уведомлений отправлено ${r.notified}` } : { info: "План уже загружен" };
}

export async function updateCampaignDates(_: SupState, form: FormData): Promise<SupState> {
  const user = await requireUser(["DEAN_OFFICE"]);
  const p = z.object({ id: z.coerce.number().int(), openBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), chooseBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Проверьте даты" };
  if (p.data.chooseBy < p.data.openBy) return { error: "Срок выбора не может быть раньше открытия приёма" };
  const n = await db.supervisionCampaign.updateMany({ where: { id: p.data.id, facultyId: user.staffFacultyId ?? -1 }, data: { openBy: new Date(p.data.openBy + "T00:00:00Z"), chooseBy: new Date(p.data.chooseBy + "T00:00:00Z") } });
  if (!n.count) return { error: "Кампания не найдена" };
  revalidatePath("/staff/plan");
  return { ok: true, info: "Сроки сохранены" };
}
