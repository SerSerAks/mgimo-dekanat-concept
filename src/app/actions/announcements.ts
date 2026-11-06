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

  await db.$transaction([
    db.announcement.create({ data: {
      authorId: user.id, title: d.title, body: d.body, important: d.important === "on",
      facultyId: user.role === "DEAN_OFFICE" ? user.staffFacultyId : null,
      departmentId: user.role === "DEPARTMENT" ? user.staffDepartmentId : null,
      course: d.audience === "course" ? d.course : null, groupId: d.audience === "group" ? d.groupId : null,
    } }),
    db.notification.createMany({ data: [...new Set(targets.map((t) => t.personId))].map((personId) => ({
      personId, type: "announcement", title: (d.important === "on" ? "Важно: " : "") + d.title, body: d.body.slice(0, 300),
    })) }),
  ]);
  revalidatePath("/staff/announcements");
  return { sent: new Set(targets.map((t) => t.personId)).size };
}
