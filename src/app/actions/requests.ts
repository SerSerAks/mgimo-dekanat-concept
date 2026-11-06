"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStudent, requireUser } from "@/lib/auth";
import { requestScope } from "@/lib/access";
import { DEAN_TRANSITIONS, notificationFor } from "@/lib/request-flow";
import { REQUEST_TYPES, addWorkdays, requestTypeLabel } from "@/lib/requests";

export type CreateState = { errors?: Record<string, string>; message?: string } | undefined;

export async function createRequest(_: CreateState, form: FormData): Promise<CreateState> {
  const user = await requireStudent();
  const type = String(form.get("type") ?? "");
  const def = REQUEST_TYPES[type];
  if (!def) return { message: "Неизвестный тип заявки" };

  // Схема собирается из описания типа: длины, обязательность, допустимые варианты — всё проверяется на сервере.
  const debts = def.fields.some((f) => f.optionsFrom === "debts")
    ? (await db.grade.findMany({ where: { enrollmentId: user.enrollment.id, isDebt: true }, select: { discipline: true } })).map((g) => g.discipline)
    : [];
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of def.fields) {
    let s: z.ZodTypeAny;
    if (f.kind === "number") s = z.coerce.number().int().min(f.min ?? 0).max(f.max ?? 99);
    else if (f.kind === "select") s = z.enum((f.optionsFrom === "debts" ? debts : f.options ?? []) as [string, ...string[]]);
    else s = z.string().trim().max(f.max ?? 200);
    if (f.required && f.kind !== "number" && f.kind !== "select") s = (s as z.ZodString).min(1, "Заполните поле");
    shape[f.name] = f.required ? s : s.optional().or(z.literal(""));
  }
  if (def.delivery) shape.delivery = z.enum(["в деканате", "электронно"]);

  const raw = Object.fromEntries(Object.keys(shape).map((k) => [k, form.get(k) ?? ""]));
  const parsed = z.object(shape).safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] = i.message.startsWith("Заполните") ? i.message : "Проверьте значение";
    return { errors };
  }
  const { delivery, ...payload } = parsed.data as Record<string, unknown>;
  const dueDate = addWorkdays(new Date(), def.days);

  const req = await db.$transaction(async (tx) => {
    const r = await tx.request.create({ data: { enrollmentId: user.enrollment.id, type, payload: payload as object, delivery: (delivery as string) ?? "в деканате", dueDate } });
    await tx.requestEvent.create({ data: { requestId: r.id, status: "NEW" } });
    await tx.notification.create({ data: { personId: user.id, type: "request", title: `Заявка №${r.number} принята`, body: `${requestTypeLabel(type)}: обычно готовим за ${def.days} раб. дн.`, link: `/requests/${r.id}` } });
    return r;
  });
  revalidatePath("/requests");
  redirect(`/requests/${req.id}?created=1`);
}

export async function cancelRequest(form: FormData) {
  const user = await requireStudent();
  const id = String(form.get("id") ?? "");
  // отменить можно только свою заявку и только пока она «Новая»
  const r = await db.request.findFirst({ where: { id, enrollment: { personId: user.id }, status: "NEW" } });
  if (!r) redirect(`/requests`);
  await db.$transaction([
    db.request.update({ where: { id }, data: { status: "CANCELLED" } }),
    db.requestEvent.create({ data: { requestId: id, status: "CANCELLED", comment: "Отменена студентом" } }),
  ]);
  revalidatePath(`/requests/${id}`);
  redirect(`/requests/${id}`);
}

// ---------- деканат: смена статуса ----------

export type StatusState = { error?: string } | undefined;

export async function changeRequestStatus(_: StatusState, form: FormData): Promise<StatusState> {
  const user = await requireUser(["DEAN_OFFICE"]);
  const id = String(form.get("id") ?? "");
  const to = String(form.get("to") ?? "");
  const comment = z.string().trim().max(500).parse(String(form.get("comment") ?? ""));
  const pickup = z.string().trim().max(120).parse(String(form.get("pickup") ?? ""));
  // заявка ищется только в области доступа деканата — чужой факультет недоступен
  const r = await db.request.findFirst({ where: { id, ...requestScope(user) }, include: { enrollment: { select: { personId: true } } } });
  if (!r) return { error: "Заявка не найдена" };
  const t = DEAN_TRANSITIONS[r.status]?.find((x) => x.to === to);
  if (!t) return { error: "Статус уже изменился — обновите страницу" };
  if (t.needs === "comment" && comment.length < 3) return { error: "Напишите комментарий для студента" };
  if (t.needs === "pickup" && r.delivery === "в деканате" && pickup.length < 3) return { error: "Укажите, где забрать документ" };

  const label = requestTypeLabel(r.type);
  const n = notificationFor(t.to, r.number, label, t.needs === "pickup" ? pickup || null : comment || null);
  await db.$transaction([
    db.request.update({ where: { id }, data: { status: t.to, ...(t.needs === "pickup" && pickup ? { pickupPlace: pickup } : {}) } }),
    db.requestEvent.create({ data: { requestId: id, status: t.to, comment: comment || null, authorId: user.id } }),
    db.notification.create({ data: { personId: r.enrollment.personId, type: "request", title: n.title, body: n.body, link: `/requests/${id}` } }),
  ]);
  revalidatePath(`/staff/requests/${id}`);
  revalidatePath("/staff/requests");
  return undefined;
}

// ---------- студент: ответ на «Нужны уточнения» ----------
export async function answerRequest(_: StatusState, form: FormData): Promise<StatusState> {
  const user = await requireStudent();
  const id = String(form.get("id") ?? "");
  const answer = z.string().trim().min(2, "Напишите ответ").max(500).safeParse(String(form.get("answer") ?? ""));
  if (!answer.success) return { error: "Напишите ответ (до 500 символов)" };
  const r = await db.request.findFirst({ where: { id, enrollment: { personId: user.id }, status: "NEEDS_INFO" } });
  if (!r) return { error: "Заявка уже не ждёт ответа" };
  await db.$transaction([
    db.request.update({ where: { id }, data: { status: "IN_PROGRESS" } }),
    db.requestEvent.create({ data: { requestId: id, status: "IN_PROGRESS", comment: `Ответ студента: ${answer.data}`, authorId: user.id } }),
  ]);
  revalidatePath(`/requests/${id}`);
  return undefined;
}
