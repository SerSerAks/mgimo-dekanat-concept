// Время считаем по Москве: студенты МГИМО и расписание — в МСК, сервер может быть в UTC.
const TZ = "Europe/Moscow";

/** Сегодняшняя дата в Москве как Date в полночь UTC (так хранятся @db.Date). */
export function todayMsk(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(ymd + "T00:00:00Z");
}

export function nowHHMM(now = new Date()) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

/** Понедельник недели, в которую входит дата. */
export function weekStart(d: Date) {
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Пн
  return addDays(d, -dow);
}

// Осенний семестр 2026/27: 1-я (нечётная) неделя — 31.08–06.09 (research §3).
const SEMESTER_WEEK1 = new Date("2026-08-31T00:00:00Z");
export function weekParity(d: Date) {
  const n = Math.floor((weekStart(d).getTime() - SEMESTER_WEEK1.getTime()) / (7 * 86400000)) + 1;
  return { number: n, odd: n % 2 === 1, label: n % 2 === 1 ? "нечётная неделя" : "чётная неделя" };
}

export const fmtDay = (d: Date) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(d);
export const fmtShort = (d: Date) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(d);
export const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
