/**
 * Вымышленные изменения поверх реального расписания (перенос, отмена, смена аудитории),
 * чтобы демо всегда показывало, как кабинет сообщает об изменениях.
 * Привязаны к «сегодня»: на сервере пересчитываются каждый день (scripts/refresh-demo.ts, cron).
 */
import type { PrismaClient } from "@prisma/client";

const DAY = 86400000;

export async function resetDemoChanges(db: PrismaClient) {
  const changed = await db.lesson.findMany({ where: { source: "SEED" } });
  for (const l of changed) {
    await db.lesson.update({
      where: { id: l.id },
      data: {
        change: "NONE", changeNote: null, changedAt: null, source: "RUZ",
        date: l.prevDate ?? l.date,
        start: l.prevStart ?? l.start,
        end: l.prevStart ? (l.changeNote?.split("|")[1] ?? l.end) : l.end,
        auditorium: l.prevAuditorium ?? l.auditorium,
        building: l.prevAuditorium ? (l.changeNote?.split("|")[2] ?? l.building) : l.building,
        prevDate: null, prevStart: null, prevAuditorium: null,
      },
    });
  }
}

export async function applyDemoChanges(db: PrismaClient, today: Date) {
  const groups = await db.group.findMany();
  for (const g of groups) {
    // подгруппа демо-студента группы, чтобы изменения были видны в его расписании
    const enr = await db.enrollment.findFirst({ where: { groupId: g.id, status: "ACTIVE", person: { login: { in: ["student1", "student2", "student3", "master1"] } } } });
    const sub = enr?.languageSubgroup ?? null;
    const near = await db.lesson.findMany({
      where: { groupId: g.id, date: { gte: today, lt: new Date(today.getTime() + 3 * DAY) }, OR: [{ subgroup: null }, ...(sub ? [{ subgroup: sub }] : [])] },
      orderBy: [{ date: "asc" }, { start: "asc" }],
    });
    // если на ближайшие дни пар нет (выходные) — берём первые пары после
    const pool = near.length >= 3 ? near : await db.lesson.findMany({
      where: { groupId: g.id, date: { gte: today }, OR: [{ subgroup: null }, ...(sub ? [{ subgroup: sub }] : [])] },
      orderBy: [{ date: "asc" }, { start: "asc" }], take: 8,
    });
    const [room, moved, cancelled] = [pool[1], pool[2], pool[4]];
    const now = new Date();
    if (room) await db.lesson.update({ where: { id: room.id }, data: {
      change: "ROOM", prevAuditorium: room.auditorium, auditorium: "405", building: "Новый корпус",
      changeNote: `Аудитория занята мероприятием.|${room.end}|${room.building}`, changedAt: now, source: "SEED",
    } });
    if (moved) await db.lesson.update({ where: { id: moved.id }, data: {
      change: "MOVED", prevDate: moved.date, prevStart: moved.start, date: new Date(moved.date.getTime() + DAY), start: "17:30", end: "18:50",
      changeNote: `Перенос по просьбе преподавателя.|${moved.end}|${moved.building}`, changedAt: now, source: "SEED",
    } });
    if (cancelled) await db.lesson.update({ where: { id: cancelled.id }, data: {
      change: "CANCELLED", changeNote: `Преподаватель на конференции, занятие будет отработано.|${cancelled.end}|${cancelled.building}`, changedAt: now, source: "SEED",
    } });
  }
}

/** Текст причины без служебных полей восстановления. */
export const noteText = (n: string | null) => n?.split("|")[0] ?? null;
