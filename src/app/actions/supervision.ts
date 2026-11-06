"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStudent, requireUser } from "@/lib/auth";
import { canChooseSupervisor } from "@/lib/access";

export type SupState = { error?: string; ok?: boolean } | undefined;

const activeCount = (supervisorId: string) => db.enrollment.count({ where: { supervisorId, status: "ACTIVE" } });

export async function sendSupervisorRequest(_: SupState, form: FormData): Promise<SupState> {
  const user = await requireStudent();
  const e = await db.enrollment.findFirstOrThrow({ where: { id: user.enrollment.id, personId: user.id } });
  if (!canChooseSupervisor(e)) return { error: "Сейчас выбрать руководителя нельзя" };
  const p = z.object({
    supervisorId: z.string().min(1),
    topic: z.string().trim().min(3, "Тема — от 3 символов").max(200),
    message: z.string().trim().min(10, "Сообщение — от 10 символов").max(1000),
  }).safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };

  if (await db.supervisorRequest.findFirst({ where: { enrollmentId: e.id, status: "PENDING" } }))
    return { error: "У вас уже есть заявка, которая ждёт ответа. Отзовите её, чтобы написать другому руководителю." };
  // руководитель — того же факультета, берёт студентов этого уровня и у него есть места
  const sup = await db.person.findFirst({
    where: { id: p.data.supervisorId, role: "SUPERVISOR", staffDepartment: { facultyId: e.facultyId }, supervisorProfile: { levels: { has: e.level } } },
    include: { supervisorProfile: true },
  });
  if (!sup?.supervisorProfile) return { error: "Руководитель не найден" };
  if ((await activeCount(sup.id)) >= sup.supervisorProfile.maxStudents) return { error: "У руководителя не осталось мест" };

  await db.$transaction([
    db.supervisorRequest.create({ data: { enrollmentId: e.id, supervisorId: sup.id, topic: p.data.topic, message: p.data.message } }),
    db.notification.create({ data: { personId: sup.id, type: "thesis", title: "Новая заявка на научное руководство", body: `${user.lastName} ${user.firstName}: «${p.data.topic}»`, link: "/staff/supervision" } }),
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

export async function decideSupervisorRequest(_: SupState, form: FormData): Promise<SupState> {
  const user = await requireUser(["SUPERVISOR"]);
  const id = String(form.get("id") ?? "");
  const decision = String(form.get("decision") ?? "");
  const reply = z.string().trim().max(500).parse(String(form.get("reply") ?? ""));
  // только заявка, адресованная этому руководителю и ещё ждущая ответа
  const r = await db.supervisorRequest.findFirst({ where: { id, supervisorId: user.id, status: "PENDING" }, include: { enrollment: { include: { thesis: true } } } });
  if (!r) return { error: "Заявка уже обработана" };

  if (decision === "decline") {
    if (reply.length < 3) return { error: "Напишите студенту причину отказа" };
    await db.$transaction([
      db.supervisorRequest.update({ where: { id }, data: { status: "DECLINED", reply, decidedAt: new Date() } }),
      db.notification.create({ data: { personId: r.enrollment.personId, type: "thesis", title: "Руководитель отклонил заявку", body: reply, link: "/supervisor" } }),
    ]);
  } else if (decision === "accept") {
    const profile = await db.supervisorProfile.findUnique({ where: { personId: user.id } });
    if (profile && (await activeCount(user.id)) >= profile.maxStudents) return { error: "У вас не осталось мест — увеличьте лимит или откажите" };
    if (r.enrollment.supervisorId) return { error: "У студента уже есть руководитель" };
    const departmentId = user.staffDepartmentId!;
    await db.$transaction([
      db.supervisorRequest.update({ where: { id }, data: { status: "ACCEPTED", reply: reply || null, decidedAt: new Date() } }),
      db.supervisorRequest.updateMany({ where: { enrollmentId: r.enrollmentId, status: "PENDING", id: { not: id } }, data: { status: "WITHDRAWN", decidedAt: new Date() } }),
      db.enrollment.update({ where: { id: r.enrollmentId }, data: { supervisorId: user.id } }),
      r.enrollment.thesis
        ? db.thesis.update({ where: { id: r.enrollment.thesis.id }, data: { topic: r.topic, topicStatus: "PENDING", stage: 2 } })
        : db.thesis.create({ data: { enrollmentId: r.enrollmentId, departmentId, topic: r.topic, topicStatus: "PENDING", stage: 2 } }),
      db.notification.create({ data: { personId: r.enrollment.personId, type: "thesis", title: "Руководитель согласился!", body: `${user.lastName} ${user.firstName} — ваш научный руководитель. Тема «${r.topic}» ушла на утверждение кафедре.${reply ? ` Комментарий: ${reply}` : ""}`, link: "/supervisor" } }),
    ]);
  } else return { error: "Неизвестное решение" };
  revalidatePath("/staff/supervision");
  revalidatePath("/staff/students");
  return { ok: true };
}
