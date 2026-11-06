import "server-only";
import { db } from "./db";

type Enr = { facultyId: number; level: "BACHELOR" | "MASTER" | "POSTGRAD"; course: number; programId: number | null };

/**
 * Практика студента: периоды его факультета, уровня и курса.
 * Если для направления (программы) задан свой период — он важнее общего факультетского.
 */
export async function practiceFor(e: Enr) {
  const all = await db.practicePeriod.findMany({
    where: { facultyId: e.facultyId, level: e.level, course: e.course, OR: [{ programId: null }, ...(e.programId ? [{ programId: e.programId }] : [])] },
    orderBy: { startDate: "asc" },
  });
  const specific = all.filter((p) => p.programId != null);
  return specific.length ? specific : all;
}
