import "server-only";
import { db } from "./db";

type Enr = { groupId: number | null; languageSubgroup: string | null };

/**
 * Пары студента за период: общие для группы + только своя языковая подгруппа.
 * Включает пары, перенесённые С этих дат (по prevDate) — чтобы в исходный день показать «перенесена».
 */
export function lessonsFor(enr: Enr, from: Date, to: Date) {
  if (!enr.groupId) return Promise.resolve([]);
  return db.lesson.findMany({
    where: {
      groupId: enr.groupId,
      AND: [
        { OR: [{ date: { gte: from, lt: to } }, { prevDate: { gte: from, lt: to } }] },
        { OR: [{ subgroup: null }, ...(enr.languageSubgroup ? [{ subgroup: enr.languageSubgroup }] : [])] },
      ],
    },
    include: { teacher: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { start: "asc" }],
  });
}

export type LessonRow = Awaited<ReturnType<typeof lessonsFor>>[number];

/** Строка расписания конкретного дня. movedAway — пара перенесена с этого дня на другой. */
export type DayItem = { lesson: LessonRow; time: string; end: string; movedAway: boolean };

export function dayItems(lessons: LessonRow[], day: Date): DayItem[] {
  const t = day.getTime();
  const items: DayItem[] = [];
  for (const l of lessons) {
    if (l.date.getTime() === t) items.push({ lesson: l, time: l.start, end: l.end, movedAway: false });
    else if (l.change === "MOVED" && l.prevDate?.getTime() === t) {
      const end = l.changeNote?.split("|")[1] ?? l.end;
      items.push({ lesson: l, time: l.prevStart ?? l.start, end, movedAway: true });
    }
  }
  return items.sort((a, b) => a.time.localeCompare(b.time));
}

export const hasChanges = (items: DayItem[]) => items.some((i) => i.lesson.change !== "NONE");

/** Минуты от начала суток для "HH:MM". */
export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
