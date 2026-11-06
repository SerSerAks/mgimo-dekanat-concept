/**
 * Кампании выбора руководителя по учебному плану года (SPEC §13).
 * Модуль без "server-only": его используют и страницы, и ночные скрипты.
 */
import type { Level, PrismaClient, WorkType } from "@prisma/client";

export const ACADEMIC_YEAR = "2026/27";

export function workLabel(w: WorkType, level: Level) {
  if (w === "COURSEWORK") return "Курсовая работа";
  if (w === "NIR") return "Научно-исследовательская работа (НИР)";
  return level === "BACHELOR" ? "Выпускная квалификационная работа" : level === "MASTER" ? "Магистерская диссертация" : "Кандидатская диссертация";
}

const d = (s: string) => new Date(s + "T00:00:00Z");
/** Шаблон учебного плана деканата: курсовые и выпускные работы (ДОПУЩЕНИЕ — сроки условные). НИР загружают кафедры сами. */
export const PLAN_TEMPLATE: { level: Level; course: number; workType: WorkType; openBy: Date; chooseBy: Date }[] = [
  { level: "BACHELOR", course: 2, workType: "COURSEWORK", openBy: d("2026-11-20"), chooseBy: d("2026-12-04") },
  { level: "BACHELOR", course: 3, workType: "COURSEWORK", openBy: d("2026-11-13"), chooseBy: d("2026-11-27") },
  { level: "BACHELOR", course: 4, workType: "THESIS", openBy: d("2026-11-10"), chooseBy: d("2026-11-24") },
  { level: "MASTER", course: 1, workType: "THESIS", openBy: d("2026-11-16"), chooseBy: d("2026-11-30") },
  { level: "POSTGRAD", course: 1, workType: "THESIS", openBy: d("2026-11-09"), chooseBy: d("2026-11-23") },
];

type Enr = { id: string; facultyId: number; level: Level; course: number; programId: number | null; departmentId?: number | null; status?: string };
type Camp = { facultyId: number; departmentId: number | null; level: Level; course: number; programId: number | null };

/** Кампании студента на текущий год; если для направления есть своя — она заменяет общую того же вида работы. */
export async function campaignsFor(db: PrismaClient, e: Enr) {
  if (e.status && e.status !== "ACTIVE") return [];
  // аспирант числится на ФАНК, но НИР ему загружает его кафедра
  const where = e.level === "POSTGRAD" && e.departmentId
    ? { OR: [{ facultyId: e.facultyId }, { departmentId: e.departmentId }] }
    : { facultyId: e.facultyId };
  const all = await db.supervisionCampaign.findMany({
    where: { AND: [where, { OR: [{ programId: null }, ...(e.programId ? [{ programId: e.programId }] : [])] }], level: e.level, course: e.course, academicYear: ACADEMIC_YEAR },
    orderBy: { chooseBy: "asc" }, include: { department: { select: { name: true } } },
  });
  // своя кампания направления заменяет общую того же вида и того же источника (деканат / та же кафедра)
  return all.filter((c) => c.programId != null || !all.some((o) => o.programId != null && o.workType === c.workType && o.departmentId === c.departmentId));
}

/** Студенты, которых касается кампания. */
export function campaignStudents(db: PrismaClient, c: Camp) {
  // аспиранты кафедры — по кафедре, остальные — по факультету
  const who = c.level === "POSTGRAD" && c.departmentId ? { departmentId: c.departmentId } : { facultyId: c.facultyId };
  return db.enrollment.findMany({
    where: { status: "ACTIVE", ...who, level: c.level, course: c.course, ...(c.programId ? { programId: c.programId } : {}) },
    select: { id: true, personId: true, supervisorId: true },
  });
}

/** Руководители кампании: кафедры (НИР) или всего факультета, которые берут студентов этого уровня. */
export function campaignSupervisors(db: PrismaClient, c: Camp) {
  const where = c.departmentId ? { staffDepartmentId: c.departmentId } : { staffDepartment: { facultyId: c.facultyId } };
  return db.person.findMany({ where: { role: "SUPERVISOR", ...where, supervisorProfile: { levels: { has: c.level } } }, select: { id: true } });
}

const fmt = (x: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "long" }).format(x);

/** Уведомления с ключом: повторный вызов не создаёт дубликатов. */
export function notifyOnce(db: PrismaClient, rows: { personId: string; dedupeKey: string; title: string; body: string; link: string; type?: string }[]) {
  if (!rows.length) return Promise.resolve({ count: 0 });
  return db.notification.createMany({ data: rows.map((r) => ({ type: "thesis", ...r })), skipDuplicates: true });
}

/** Загрузка учебного плана года на факультет: кампании по шаблону + первые уведомления. */
export async function loadYearPlan(db: PrismaClient, facultyId: number) {
  let created = 0, notified = 0;
  for (const t of PLAN_TEMPLATE) {
    const exists = await db.supervisionCampaign.findFirst({ where: { facultyId, departmentId: null, programId: null, level: t.level, course: t.course, workType: t.workType, academicYear: ACADEMIC_YEAR } });
    if (exists) continue;
    const c = await db.supervisionCampaign.create({ data: { facultyId, ...t, academicYear: ACADEMIC_YEAR } });
    created++;
    notified += (await announceCampaign(db, c)).count;
  }
  return { created, notified };
}

export async function announceCampaign(db: PrismaClient, c: Camp & { id: number; workType: WorkType; openBy: Date; chooseBy: Date }) {
  const what = `${workLabel(c.workType, c.level)}, ${c.course} курс`;
  const [sups, studs] = await Promise.all([campaignSupervisors(db, c), campaignStudents(db, c)]);
  return notifyOnce(db, [
    ...sups.map((s) => ({ personId: s.id, dedupeKey: `camp:${c.id}:sup:${s.id}:start`, title: "Откройте приём студентов", body: `${what}: откройте приём и укажите число мест до ${fmt(c.openBy)}.`, link: "/staff/supervision" })),
    ...studs.filter((s) => !(c.workType === "THESIS" && s.supervisorId)).map((s) => ({ personId: s.personId, dedupeKey: `camp:${c.id}:stu:${s.personId}:start`, title: "Пора выбрать научного руководителя", body: `${what}: выберите руководителя до ${fmt(c.chooseBy)}. Приём откроется до ${fmt(c.openBy)}.`, link: "/supervisor" })),
  ]);
}

/** Ежедневные напоминания: руководителям — открыть приём, студентам — выбрать руководителя. */
export async function runReminders(db: PrismaClient, today: Date) {
  const DAY = 86400000;
  const daysTo = (x: Date) => Math.round((x.getTime() - today.getTime()) / DAY);
  const camps = await db.supervisionCampaign.findMany({ where: { academicYear: ACADEMIC_YEAR }, include: { intakes: true, requests: { where: { status: { in: ["ACCEPTED", "PENDING"] } } } } });
  let sent = 0;
  for (const c of camps) {
    const what = `${workLabel(c.workType, c.level)}, ${c.course} курс`;
    const toOpen = daysTo(c.openBy);
    if (toOpen === 3 || toOpen === 0) {
      const opened = new Set(c.intakes.map((i) => i.supervisorId));
      const sups = (await campaignSupervisors(db, c)).filter((s) => !opened.has(s.id));
      sent += (await notifyOnce(db, sups.map((s) => ({ personId: s.id, dedupeKey: `camp:${c.id}:sup:${s.id}:d${toOpen}`, title: toOpen ? "Через 3 дня — срок открытия приёма" : "Сегодня последний день открыть приём", body: `${what}: студенты ждут, когда вы откроете приём.`, link: "/staff/supervision" })))).count;
    }
    const toChoose = daysTo(c.chooseBy);
    if (toChoose === 7 || toChoose === 2) {
      const done = new Set(c.requests.filter((r) => r.status === "ACCEPTED").map((r) => r.enrollmentId));
      const studs = (await campaignStudents(db, c)).filter((s) => !done.has(s.id) && !(c.workType === "THESIS" && s.supervisorId));
      sent += (await notifyOnce(db, studs.map((s) => ({ personId: s.personId, dedupeKey: `camp:${c.id}:stu:${s.personId}:d${toChoose}`, title: `Осталось ${toChoose === 7 ? "7 дней" : "2 дня"}: выберите руководителя`, body: `${what}: срок — ${fmt(c.chooseBy)}.`, link: "/supervisor" })))).count;
    }
  }
  return sent;
}
