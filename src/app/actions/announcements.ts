"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { enrollmentScope } from "@/lib/access";

export type AnnState = { error?: string; sent?: number } | undefined;

const Schema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
  important: z.string().optional(),
  audience: z.enum(["all", "course", "group"]),
  course: z.coerce.number().int().min(1).max(6).optional(),
  groupId: z.coerce.number().int().optional(),
});

/**
 * Объявление получают только студенты из области доступа автора (enrollmentScope):
 * деканат — свой факультет, руководитель — свои студенты, кафедра — свои выпускники.
 * Сузить можно до курса или группы — но не расширить за пределы области.
 */
export async function publishAnnouncement(_: AnnState, form: FormData): Promise<AnnState> {
  const user = await requireUser(["DEAN_OFFICE", "SUPERVISOR", "DEPARTMENT"]);
  const p = Schema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Заполните заголовок и текст (от 3 символов)" };
  const d = p.data;
  const narrow: Prisma.EnrollmentWhereInput =
    d.audience === "course" && d.course ? { course: d.course } : d.audience === "group" && d.groupId ? { groupId: d.groupId } : {};
  const targets = await db.enrollment.findMany({ where: { AND: [enrollmentScope(user), { status: "ACTIVE" }, narrow] }, select: { personId: true } });
  if (targets.length === 0) return { error: "Нет получателей с такими условиями" };

  const id = (await import("node:crypto")).randomUUID();
  await db.$transaction([
    db.announcement.create({ data: { id,
      authorId: user.id, title: d.title, body: d.body, important: d.important === "on",
      facultyId: user.role === "DEAN_OFFICE" ? user.staffFacultyId : null,
      departmentId: user.role === "DEPARTMENT" ? user.staffDepartmentId : null,
      course: d.audience === "course" ? d.course : null, groupId: d.audience === "group" ? d.groupId : null,
    } }),
    db.notification.createMany({ data: [...new Set(targets.map((t) => t.personId))].map((personId) => ({
      personId, type: "announcement", title: (d.important === "on" ? "Важно: " : "") + d.title, body: d.body.slice(0, 300),
      dedupeKey: `ann:${id}:${personId}`, // по ключу уведомление обновится, если объявление исправят
    })) }),
  ]);
  revalidatePath("/staff/announcements");
  return { sent: new Set(targets.map((t) => t.personId)).size };
}

// ---------- исправление опубликованного объявления ----------

export type EditAnnState = { error?: string; ok?: string } | undefined;

const EditSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
  important: z.string().optional(),
});

/**
 * Автор исправляет своё объявление в любой момент, даже после публикации.
 * Получатели остаются прежними; их уведомления обновляются и снова становятся непрочитанными с пометкой «исправлено».
 */
export async function updateAnnouncement(_: EditAnnState, form: FormData): Promise<EditAnnState> {
  const user = await requireUser(["DEAN_OFFICE", "SUPERVISOR", "DEPARTMENT"]);
  const p = EditSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Заголовок и текст — от 3 символов" };
  const d = p.data;
  const a = await db.announcement.findFirst({ where: { id: d.id, authorId: user.id } }); // чужое = «не найдено»
  if (!a) return { error: "Объявление не найдено" };
  const important = d.important === "on";
  if (a.title === d.title && a.body === d.body && a.important === important) return { error: "Ничего не изменилось" };

  const title = `${important ? "Важно: " : ""}${d.title} (исправлено)`;
  const data = { title, body: d.body.slice(0, 300), readAt: null };
  const [, byKey] = await db.$transaction([
    db.announcement.update({ where: { id: a.id }, data: { title: d.title, body: d.body, important, editedAt: new Date() } }),
    db.notification.updateMany({ where: { dedupeKey: { startsWith: `ann:${a.id}:` } }, data }),
  ]);
  // объявления, опубликованные до появления ключа, находим по прежнему тексту
  let legacy = { count: 0 };
  if (byKey.count === 0) {
    const oldTitle = `${a.important ? "Важно: " : ""}${a.title}`;
    legacy = await db.notification.updateMany({
      where: { type: "announcement", dedupeKey: null, title: { in: [oldTitle, `${oldTitle} (исправлено)`] }, body: a.body.slice(0, 300), createdAt: { gte: new Date(a.publishedAt.getTime() - 60_000) } },
      data,
    });
  }
  revalidatePath("/staff/announcements");
  return { ok: `Исправлено. Обновлено уведомлений: ${byKey.count + legacy.count}` };
}
