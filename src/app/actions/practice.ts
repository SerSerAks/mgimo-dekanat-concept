"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type PracticeState = { error?: string; ok?: boolean } | undefined;

const Schema = z.object({
  level: z.enum(["BACHELOR", "MASTER", "POSTGRAD"]),
  course: z.coerce.number().int().min(1).max(6),
  programId: z.union([z.literal(""), z.coerce.number().int()]),
  kind: z.enum(["Учебная", "Производственная", "Преддипломная", "Педагогическая"]),
  title: z.string().trim().min(3).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  docsDeadline: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  note: z.string().trim().max(200).optional(),
});

/** Деканат настраивает практику ТОЛЬКО своего факультета: facultyId берётся из учётной записи, а не из формы. */
export async function addPractice(_: PracticeState, form: FormData): Promise<PracticeState> {
  const user = await requireUser(["DEAN_OFFICE"]);
  if (user.staffFacultyId == null) return { error: "Нет привязки к факультету" };
  const p = Schema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Проверьте поля формы" };
  const d = p.data;
  if (d.endDate < d.startDate) return { error: "Окончание раньше начала" };
  if (d.programId !== "") {
    const prog = await db.program.findFirst({ where: { id: d.programId, facultyId: user.staffFacultyId } });
    if (!prog) return { error: "Направление не относится к вашему факультету" };
  }
  const day = (s: string) => new Date(s + "T00:00:00Z");
  await db.practicePeriod.create({ data: {
    facultyId: user.staffFacultyId, level: d.level, course: d.course, programId: d.programId === "" ? null : d.programId,
    kind: d.kind, title: d.title, startDate: day(d.startDate), endDate: day(d.endDate),
    docsDeadline: d.docsDeadline ? day(d.docsDeadline) : null, note: d.note || null,
  } });
  revalidatePath("/staff/practice");
  return { ok: true };
}

export async function deletePractice(form: FormData) {
  const user = await requireUser(["DEAN_OFFICE"]);
  const id = Number(form.get("id"));
  await db.practicePeriod.deleteMany({ where: { id, facultyId: user.staffFacultyId ?? -1 } });
  revalidatePath("/staff/practice");
}
