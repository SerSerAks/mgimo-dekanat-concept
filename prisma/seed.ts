/**
 * Тестовые данные «Цифрового деканата». ВСЕ люди, оценки, заявки и номера — вымышленные.
 * Реальные только открытые данные МГИМО: факультеты, направления (docs/content/programs.csv),
 * расписание групп (data/ruz-snapshot.json, без преподавателей).
 *
 * Пароли тестовых аккаунтов: из переменных DEMO_PASSWORD_<ЛОГИН> или генерируются случайно
 * и записываются в .demo-accounts.local.md (файл в .gitignore). В коде паролей нет.
 */
import { PrismaClient, type Level, type RequestStatus, type ControlType } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/password";
import { toMark } from "../src/config/grading";
import { applyDemoChanges } from "./demo-changes";
import { seedSupervision } from "./supervision-seed";
import { seedAccounts } from "./accounts-seed";

const db = new PrismaClient();
const DAY = 86400000;
const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const daysFrom = (n: number) => new Date(today.getTime() + n * DAY);

// детерминированный «случайный» генератор — данные одинаковы при каждом запуске
let seedN = 42;
const rnd = () => ((seedN = (seedN * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];

const LAST_M = ["Воронцов", "Беляев", "Громов", "Орлов", "Лебедев", "Соколов", "Миронов", "Карпов", "Зайцев", "Тихонов", "Ершов", "Комаров"];
const LAST_F = ["Воронцова", "Беляева", "Громова", "Орлова", "Лебедева", "Соколова", "Миронова", "Карпова", "Зайцева", "Тихонова", "Ершова", "Комарова"];
const FIRST_M = ["Артём", "Илья", "Максим", "Даниил", "Кирилл", "Никита", "Егор", "Матвей"];
const FIRST_F = ["Анна", "Мария", "Софья", "Алиса", "Вероника", "Полина", "Дарья", "Ева"];
const MID_M = ["Андреевич", "Сергеевич", "Игоревич", "Олегович", "Павлович"];
const MID_F = ["Андреевна", "Сергеевна", "Игоревна", "Олеговна", "Павловна"];
function fakeName(female = rnd() < 0.5) {
  return female
    ? { lastName: pick(LAST_F), firstName: pick(FIRST_F), middleName: pick(MID_F) }
    : { lastName: pick(LAST_M), firstName: pick(FIRST_M), middleName: pick(MID_M) };
}

const FACULTIES = [
  ["МО", "Факультет международных отношений", "A"],
  ["МП", "Международно-правовой факультет", "B"],
  ["МЭО", "Факультет международных экономических отношений", "B"],
  ["МЖ", "Факультет международной журналистики", "A"],
  ["МБ", "Факультет международного бизнеса", "B"],
  ["ФУП", "Факультет управления и политики", "A"],
  ["ИМТУР", "Институт международной торговли и устойчивого развития", "B"],
  ["МИЭП", "Международный институт энергетической политики и дипломатии", "B"],
  ["ФАНК", "Факультет подготовки и аттестации научных кадров", "A"],
] as const;

const credentials: [string, string, string][] = [];
async function account(login: string, role: "STUDENT" | "DEAN_OFFICE" | "SUPERVISOR" | "DEPARTMENT", who: string, extra: Record<string, unknown> = {}, female?: boolean, listed = true) {
  const envKey = `DEMO_PASSWORD_${login.toUpperCase()}`;
  const password = process.env[envKey] || randomBytes(9).toString("base64url");
  if (listed) credentials.push([login, password, who]);
  return db.person.create({ data: { login, role, passwordHash: await hashPassword(password), ...fakeName(female), ...extra } });
}

async function wipe() {
  // порядок важен из-за внешних ключей
  await db.$transaction([
    db.supervisorRequest.deleteMany(), db.supervisorIntake.deleteMany(), db.supervisionCampaign.deleteMany(), db.supervisorProfile.deleteMany(), db.event.deleteMany(), db.practicePeriod.deleteMany(), db.antiplagiatCheck.deleteMany(), db.announcementRead.deleteMany(), db.announcement.deleteMany(), db.notification.deleteMany(),
    db.thesisComment.deleteMany(), db.chapterVersion.deleteMany(), db.chapter.deleteMany(), db.thesisEvent.deleteMany(),
    db.thesis.deleteMany(), db.thesisTopic.deleteMany(), db.planItem.deleteMany(), db.requestEvent.deleteMany(), db.request.deleteMany(),
    db.grade.deleteMany(), db.programFavorite.deleteMany(), db.portfolioItem.deleteMany(), db.enrollment.deleteMany(),
    db.session.deleteMany(), db.loginAttempt.deleteMany(), db.person.deleteMany(), db.lesson.deleteMany(), db.exam.deleteMany(),
    db.teacher.deleteMany(), db.group.deleteMany(), db.program.deleteMany(), db.department.deleteMany(), db.faculty.deleteMany(),
  ]);
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    throw new Error("Seed в production удаляет все данные. Запустите с ALLOW_SEED=1, если это намеренно.");
  }
  await wipe();

  // ---------- справочники ----------
  const fac: Record<string, number> = {};
  for (const [code, name, pairGrid] of FACULTIES) fac[code] = (await db.faculty.create({ data: { code, name, pairGrid } })).id;

  const dep = {
    mpIntLaw: (await db.department.create({ data: { name: "Кафедра международного права", facultyId: fac["МП"] } })).id,
    mpConst: (await db.department.create({ data: { name: "Кафедра конституционного права", facultyId: fac["МП"] } })).id,
    fupGov: (await db.department.create({ data: { name: "Кафедра государственного управления", facultyId: fac["ФУП"] } })).id,
    moDip: (await db.department.create({ data: { name: "Кафедра дипломатии", facultyId: fac["МО"] } })).id,
    fank: (await db.department.create({ data: { name: "Кафедра методологии научных исследований", facultyId: fac["ФАНК"] } })).id,
  };

  // направления из programs.csv (открытые данные приёма 2026)
  const csv = readFileSync("docs/content/programs.csv", "utf-8").replace(/^﻿/, "").trim().split("\n").slice(1);
  const LEVELS: Record<string, Level> = { "бакалавриат": "BACHELOR", "магистратура": "MASTER", "аспирантура": "POSTGRAD" };
  const num = (s: string) => (s ? Number(s) : null);
  for (const line of csv) {
    const [level, campus, facultyLabel, code, direction, name, budget, target, contract, source] = line.split(";");
    await db.program.create({
      data: {
        level: LEVELS[level], campus, facultyLabel, facultyId: fac[facultyLabel] ?? null, specialtyCode: code || null,
        direction, name, budget: num(budget), target: num(target), contract: num(contract), source,
      },
    });
  }
  const prog = (level: Level, direction: string, name = "") =>
    db.program.findFirstOrThrow({ where: { level, direction, ...(name ? { name: { contains: name } } : {}) } });

  // ---------- группы и расписание из снимка РУЗ ----------
  const snap = JSON.parse(readFileSync("data/ruz-snapshot.json", "utf-8"));
  const GROUP_META: Record<string, { faculty: string; level: Level; course: number }> = {
    "1МО-01": { faculty: "МО", level: "BACHELOR", course: 1 },
    "4МП-02": { faculty: "МП", level: "BACHELOR", course: 4 },
    "2МагГУ-01": { faculty: "ФУП", level: "MASTER", course: 2 },
  };
  const teacherByDiscipline = new Map<string, number>();
  const TITLES = ["доцент", "профессор", "старший преподаватель", "преподаватель"];
  const grp: Record<string, number> = {};
  for (const [name, g] of Object.entries<{ ruzId: number; lessons: Record<string, string | null>[] }>(snap.groups)) {
    const m = GROUP_META[name];
    if (!m) continue; // остальные группы создают тематические модули (например, 3УП-01 — supervision-seed)
    grp[name] = (await db.group.create({ data: { name, ruzId: g.ruzId, level: m.level, course: m.course, facultyId: fac[m.faculty] } })).id;
    const rows = [];
    for (const l of g.lessons) {
      const disc = l.discipline!;
      if (!teacherByDiscipline.has(disc)) {
        const n = fakeName();
        const t = await db.teacher.create({ data: { name: `${n.lastName} ${n.firstName[0]}. ${n.middleName[0]}.`, title: pick(TITLES) } });
        teacherByDiscipline.set(disc, t.id);
      }
      rows.push({
        groupId: grp[name], date: new Date(l.date + "T00:00:00Z"), start: l.beginLesson!, end: l.endLesson!,
        discipline: disc, kind: l.kindOfWork ?? "", auditorium: l.auditorium ?? "", building: l.building ?? "",
        subgroup: l.subGroup, teacherId: teacherByDiscipline.get(disc)!,
      });
    }
    await db.lesson.createMany({ data: rows });
  }
  const subgroupOf = (group: string, prefix: string) =>
    (snap.groups[group].lessons as { subGroup: string | null }[]).map((l) => l.subGroup).find((s) => s?.startsWith(prefix)) ?? null;

  // ---------- сотрудники ----------
  const deanMo = await account("dean_mo", "DEAN_OFFICE", "Деканат факультета МО", { staffFacultyId: fac["МО"] });
  const deanMp = await account("dean_mp", "DEAN_OFFICE", "Деканат факультета МП", { staffFacultyId: fac["МП"] });
  const sup1 = await account("supervisor1", "SUPERVISOR", "Научный руководитель (кафедра гос. управления)", { staffDepartmentId: dep.fupGov });
  const sup2 = await account("supervisor_mp", "SUPERVISOR", "Научный руководитель (кафедра междунар. права)", { staffDepartmentId: dep.mpIntLaw }, undefined, false);
  await account("dept_mp", "DEPARTMENT", "Кафедра международного права (МП)", { staffDepartmentId: dep.mpIntLaw });

  // ---------- студенты ----------
  let card = 100;
  const cardNo = (year: number, code: string) => `${String(year).slice(2)}-${code}-${String(++card).padStart(4, "0")}`; // формат ДОПУЩЕНИЕ

  const s1 = await account("student1", "STUDENT", "Бакалавр, 1 курс МО, группа 1МО-01", { avatarColor: "#18478D" }, true);
  const s1e = await db.enrollment.create({ data: {
    personId: s1.id, level: "BACHELOR", facultyId: fac["МО"], groupId: grp["1МО-01"], course: 1, programId: (await prog("BACHELOR", "Зарубежное регионоведение")).id,
    languageSubgroup: subgroupOf("1МО-01", "01-"), studentCardNo: cardNo(2026, "МО"), startDate: new Date("2026-09-01"),
  } });

  const s2 = await account("student2", "STUDENT", "Бакалавр, 4 курс МП, группа 4МП-02 (ВКР)", { avatarColor: "#009FE3" }, false);
  const s2e = await db.enrollment.create({ data: {
    personId: s2.id, level: "BACHELOR", facultyId: fac["МП"], groupId: grp["4МП-02"], course: 4, programId: (await prog("BACHELOR", "Юриспруденция", "Международно-правовая")).id,
    studentCardNo: cardNo(2023, "МП"), startDate: new Date("2023-09-01"), supervisorId: sup2.id, funding: "договор",
  } });

  const m1 = await account("master1", "STUDENT", "Магистр, 2 курс ФУП, группа 2МагГУ-01; в архиве — бакалавриат", { avatarColor: "#0447A0", showPastToStaff: false }, true);
  const m1past = await db.enrollment.create({ data: {
    personId: m1.id, level: "BACHELOR", status: "GRADUATED", facultyId: fac["ФУП"], course: 4, programId: (await prog("BACHELOR", "Государственное и муниципальное управление")).id,
    studentCardNo: cardNo(2021, "ФУП"), startDate: new Date("2021-09-01"), endDate: new Date("2025-06-30"), finalGpa: 4.7,
  } });
  const m1e = await db.enrollment.create({ data: {
    personId: m1.id, level: "MASTER", facultyId: fac["ФУП"], groupId: grp["2МагГУ-01"], course: 2, programId: (await prog("MASTER", "Государственное и муниципальное управление", "Государственное управление")).id,
    studentCardNo: cardNo(2025, "ФУП"), startDate: new Date("2025-09-01"), supervisorId: sup1.id, studyForm: "очно-заочная",
  } });

  const p1 = await account("postgrad1", "STUDENT", "Аспирант, 2 год, ФАНК; в архиве — бакалавриат и магистратура", { avatarColor: "#1D2252" }, false);
  await db.enrollment.create({ data: {
    personId: p1.id, level: "BACHELOR", status: "GRADUATED", facultyId: fac["ФУП"], course: 4, programId: (await prog("BACHELOR", "Политология")).id,
    studentCardNo: cardNo(2018, "ФУП"), startDate: new Date("2018-09-01"), endDate: new Date("2022-06-30"), finalGpa: 4.8,
  } });
  const p1master = await db.enrollment.create({ data: {
    personId: p1.id, level: "MASTER", status: "GRADUATED", facultyId: fac["ФУП"], course: 2, programId: (await prog("MASTER", "Государственное и муниципальное управление", "Государственное управление")).id,
    studentCardNo: cardNo(2022, "ФУП"), startDate: new Date("2022-09-01"), endDate: new Date("2024-06-30"), finalGpa: 4.9, supervisorId: sup1.id,
  } });
  const p1e = await db.enrollment.create({ data: {
    personId: p1.id, level: "POSTGRAD", facultyId: fac["ФАНК"], course: 2, programId: (await prog("POSTGRAD", "Политические науки", "Политические институты")).id,
    studentCardNo: cardNo(2025, "ФАНК"), startDate: new Date("2025-10-01"), supervisorId: sup1.id,
  } });

  // массовка для очереди деканата (без логинов в списке для жюри)
  const extras: { id: string; fac: string; group: string }[] = [];
  for (let i = 1; i <= 7; i++) {
    const p = await account(`demo_mo_${i}`, "STUDENT", "", {}, undefined, false);
    const e = await db.enrollment.create({ data: { personId: p.id, level: "BACHELOR", facultyId: fac["МО"], groupId: grp["1МО-01"], course: 1, studentCardNo: cardNo(2026, "МО"), startDate: new Date("2026-09-01") } });
    extras.push({ id: e.id, fac: "МО", group: "1МО-01" });
  }
  for (let i = 1; i <= 3; i++) {
    const p = await account(`demo_mp_${i}`, "STUDENT", "", {}, undefined, false);
    const e = await db.enrollment.create({ data: { personId: p.id, level: "BACHELOR", facultyId: fac["МП"], groupId: grp["4МП-02"], course: 4, studentCardNo: cardNo(2023, "МП"), startDate: new Date("2023-09-01") } });
    extras.push({ id: e.id, fac: "МП", group: "4МП-02" });
  }

  // ---------- оценки ----------
  async function grades(enrollmentId: string, semester: number, list: [string, ControlType, number | null, boolean?][]) {
    for (const [discipline, controlType, score, inProgress] of list) {
      const s = score ?? 0;
      const mark = inProgress || score == null ? null : controlType === "CREDIT" ? (s >= 60 ? "зачтено" : "не зачтено") : toMark(s).mark;
      await db.grade.create({ data: {
        enrollmentId, semester, discipline, controlType, score,
        mark, ects: inProgress || score == null || controlType === "CREDIT" ? null : toMark(s).ects,
        isDebt: !inProgress && score != null && s < 60,
        components: inProgress
          ? [{ name: "Работа на семинарах", max: 30, score: Math.round(s * 0.3) }, { name: "Контрольные", max: 30, score: Math.round(s * 0.3) }, { name: "Экзамен", max: 40, score: null }]
          : [{ name: "Работа на семинарах", max: 30, score: Math.round(s * 0.3) }, { name: "Контрольные", max: 30, score: Math.round(s * 0.3) }, { name: "Экзамен", max: 40, score: s - 2 * Math.round(s * 0.3) }],
      } });
    }
  }
  // student1 — 1-й семестр идёт, баллы текущие (одна дисциплина в зоне риска)
  await grades(s1e.id, 1, [
    ["История России", "EXAM", 48, true], ["Всеобщая история", "EXAM", 52, true], ["Введение в зарубежное регионоведение", "EXAM", 55, true],
    ["Экономическая теория", "EXAM", 31, true], ["японский первый", "GRADED_CREDIT", 50, true], ["Культура работы с данными", "CREDIT", 44, true],
  ]);
  // student2 — 7-й семестр идёт, прошлые закрыты, один долг с 6-го
  await grades(s2e.id, 6, [
    ["Уголовное право", "EXAM", 86], ["Гражданское право", "EXAM", 91], ["Международное частное право", "EXAM", 78],
    ["Налоговое право", "EXAM", 54], ["французский первый", "GRADED_CREDIT", 88], ["Физическая культура и спорт", "CREDIT", 70],
  ]);
  await grades(s2e.id, 7, [
    ["Финансовое право", "EXAM", 45, true], ["Европейское право", "EXAM", 50, true], ["Уголовный процесс", "EXAM", 41, true], ["Гражданский процесс", "GRADED_CREDIT", 47, true],
  ]);
  await grades(m1past.id, 8, [["Государственная политика и управление", "EXAM", 93], ["Управление проектами", "EXAM", 88], ["Преддипломная практика", "GRADED_CREDIT", 95]]);
  await grades(m1e.id, 2, [["Налоговое администрирование госкорпораций", "EXAM", 89], ["Стратегическое планирование", "EXAM", 92], ["английский первый", "GRADED_CREDIT", 84]]);
  await grades(m1e.id, 3, [["Налоговое администрирование госкорпораций", "EXAM", 46, true], ["английский первый", "GRADED_CREDIT", 41, true]]);
  await grades(p1master.id, 4, [["Научно-исследовательский семинар", "GRADED_CREDIT", 96]]);

  // ---------- заявки ----------
  async function request(enrollmentId: string, type: string, flow: RequestStatus[], payload: object, ageDays: number, author: string, extra: { pickupPlace?: string; comment?: string } = {}) {
    const created = new Date(Date.now() - ageDays * DAY);
    const r = await db.request.create({ data: { enrollmentId, type, status: flow[flow.length - 1], payload, createdAt: created, pickupPlace: extra.pickupPlace } });
    let t = created.getTime();
    for (const [i, st] of flow.entries()) {
      await db.requestEvent.create({ data: { requestId: r.id, status: st, authorId: i === 0 ? null : author, comment: i === flow.length - 1 ? extra.comment : null, createdAt: new Date(t) } });
      t += 0.7 * DAY;
    }
    return r;
  }
  const r1 = await request(s1e.id, "study_cert", ["NEW", "IN_PROGRESS", "READY"], { place: "По месту требования", copies: 2 }, 3, deanMo.id, { pickupPlace: "каб. 214, пн–пт 10:00–17:00" });
  await request(s1e.id, "military_cert", ["NEW", "IN_PROGRESS"], { place: "Военный комиссариат (вымышленный)", copies: 1 }, 1, deanMo.id);
  await request(s2e.id, "retake", ["NEW"], { discipline: "Налоговое право", date: "по графику пересдач" }, 0, deanMp.id);
  const r2 = await request(s2e.id, "visa_cert", ["NEW", "IN_PROGRESS", "NEEDS_INFO"], { country: "Сербия", dates: "10–20 января" }, 4, deanMp.id, { comment: "Уточните, нужна ли справка с печатью на английском и на сербском?" });
  await request(s2e.id, "study_cert", ["NEW", "IN_PROGRESS", "READY", "ISSUED"], { place: "Банк", copies: 1 }, 30, deanMp.id);
  await request(m1e.id, "session_call", ["NEW", "IN_PROGRESS"], { employer: "ООО «Пример»", period: "январь" }, 2, deanMo.id);
  const types = ["study_cert", "military_cert", "social_cert", "scholarship_cert", "individual_schedule", "financial_aid"];
  const flows: RequestStatus[][] = [["NEW"], ["NEW"], ["NEW", "IN_PROGRESS"], ["NEW", "IN_PROGRESS", "READY"], ["NEW", "REJECTED"], ["NEW"], ["NEW", "IN_PROGRESS"]];
  for (const [i, e] of extras.entries()) {
    await request(e.id, types[i % types.length], flows[i % flows.length], { place: "По месту требования", copies: 1 }, i % 5, e.fac === "МО" ? deanMo.id : deanMp.id);
  }

  // ---------- ВКР / диссертации ----------
  const t2 = await db.thesis.create({ data: {
    enrollmentId: s2e.id, departmentId: dep.mpIntLaw, topic: "Иммунитет государства в спорах о суверенных долгах",
    annotation: "Сравнение подходов судов разных юрисдикций к иммунитету государства по долговым обязательствам.", topicStatus: "APPROVED", stage: 4,
  } });
  const ch1 = await db.chapter.create({ data: { thesisId: t2.id, order: 1, title: "Введение", status: "ACCEPTED", dueDate: daysFrom(-20) } });
  const ch2 = await db.chapter.create({ data: { thesisId: t2.id, order: 2, title: "Глава 1. Доктрины иммунитета государства", status: "NEEDS_FIX", dueDate: daysFrom(-3) } });
  await db.chapter.create({ data: { thesisId: t2.id, order: 3, title: "Глава 2. Практика судов", status: "DRAFT", dueDate: daysFrom(12) } });
  await db.chapterVersion.create({ data: { chapterId: ch1.id, fileName: "vvedenie_v2.docx", fileSize: 48211, storageKey: "demo/vvedenie_v2.docx" } });
  await db.chapterVersion.create({ data: { chapterId: ch2.id, fileName: "glava1_v1.docx", fileSize: 120554, storageKey: "demo/glava1_v1.docx" } });
  await db.thesisComment.create({ data: { thesisId: t2.id, chapterId: ch2.id, authorId: sup2.id, body: "Раздел 1.2 нужно дополнить практикой ЕСПЧ. Список литературы оформите по ГОСТ." } });
  for (const [stage, d] of [[1, -90], [2, -80], [3, -70], [4, -60]]) await db.thesisEvent.create({ data: { thesisId: t2.id, stage, at: daysFrom(d) } });

  const tm = await db.thesis.create({ data: {
    enrollmentId: m1e.id, departmentId: dep.fupGov, topic: "Налоговое администрирование государственных корпораций: модели и риски",
    topicStatus: "APPROVED", stage: 4,
  } });
  await db.chapter.create({ data: { thesisId: tm.id, order: 1, title: "Глава 1", status: "ON_REVIEW", dueDate: daysFrom(9) } });

  const tp = await db.thesis.create({ data: {
    enrollmentId: p1e.id, departmentId: dep.fupGov, topic: "Институты управления государственными корпорациями в России",
    annotation: "Развитие темы магистерской диссертации.", topicStatus: "APPROVED", stage: 3,
  } });
  await db.thesisEvent.create({ data: { thesisId: tp.id, stage: 3, at: daysFrom(-200) } });

  for (const [category, title, due, done] of [
    ["Кандидатский экзамен", "История и философия науки", -150, true], ["Кандидатский экзамен", "Иностранный язык", -140, true],
    ["Кандидатский экзамен", "Специальность", 160, false], ["Публикация", "Статья в журнале из перечня ВАК (1 из 3)", -30, true],
    ["Публикация", "Статья в журнале из перечня ВАК (2 из 3)", 60, false], ["Педпрактика", "Семинары у магистрантов, 36 часов", 40, false],
    ["Аттестация", "Промежуточная аттестация за 3 семестр", 50, false],
  ] as const) {
    await db.planItem.create({ data: { enrollmentId: p1e.id, category, title, dueDate: daysFrom(due), done, approved: done } });
  }

  await db.thesisTopic.createMany({ data: [
    { departmentId: dep.mpIntLaw, level: "BACHELOR", title: "Ответственность международных организаций", description: "Анализ проектов статей Комиссии международного права.", supervisorId: sup2.id },
    { departmentId: dep.mpIntLaw, level: "BACHELOR", title: "Цифровые доказательства в международном арбитраже", description: "Допустимость и оценка электронных доказательств." },
    { departmentId: dep.fupGov, level: "MASTER", title: "Проектное управление в органах власти", description: "Сравнение региональных практик.", supervisorId: sup1.id },
  ] });

  // ---------- портфолио (сквозной путь) ----------
  await db.portfolioItem.createMany({ data: [
    { personId: m1.id, type: "Олимпиада", title: "Призёр студенческой олимпиады по госуправлению", date: new Date("2024-04-12") },
    { personId: m1.id, type: "Стажировка", title: "Стажировка в аналитическом центре (вымышленном)", date: new Date("2024-07-01") },
    { personId: p1.id, type: "Публикация", title: "Статья о корпоративном управлении (вымышленная)", date: new Date("2025-10-20") },
    { personId: p1.id, type: "Конференция", title: "Доклад на молодёжной научной конференции", date: new Date("2026-04-15") },
    { personId: s2.id, type: "Конференция", title: "Участие в модели ООН", date: new Date("2025-03-10") },
  ] });

  // ---------- объявления и уведомления ----------
  await db.announcement.createMany({ data: [
    { authorId: deanMo.id, facultyId: fac["МО"], important: true, title: "Анкетирование о качестве преподавания", body: "Открыт мониторинг качества преподавания осеннего семестра. Анкета анонимная, займёт 10 минут." },
    { authorId: deanMp.id, facultyId: fac["МП"], course: 4, title: "Утверждение тем ВКР", body: "Темы выпускных работ нужно выбрать до 1 декабря. Свободные темы кафедр — в разделе Учёба → ВКР." },
    { authorId: deanMp.id, facultyId: fac["МП"], important: true, title: "Запись на пересдачи открыта", body: "Записаться можно в кабинете: Заявки → Запись на пересдачу." },
  ] });
  const notify = (personId: string, type: string, title: string, body: string, link?: string, hoursAgo = 1, read = false) =>
    db.notification.create({ data: { personId, type, title, body, link, createdAt: new Date(Date.now() - hoursAgo * 3600000), readAt: read ? new Date() : null } });
  await notify(s1.id, "request", "Справка готова", "Справка об обучении готова: каб. 214, пн–пт 10:00–17:00.", `/requests/${r1.id}`, 5);
  await notify(s1.id, "schedule", "Изменение в расписании", "Одна из пар на этой неделе перенесена. Подробности — на экране «Сегодня».", "/today", 2);
  await notify(s1.id, "announcement", "Анкетирование о качестве преподавания", "Анкета анонимная, займёт 10 минут.", undefined, 30, true);
  await notify(s2.id, "request", "По заявке есть вопрос", "Деканату нужно уточнение по справке для визы.", `/requests/${r2.id}`, 3);
  await notify(s2.id, "thesis", "Замечания к главе 1", "Научный руководитель оставил замечания к главе «Доктрины иммунитета государства».", "/study", 20);
  await notify(m1.id, "thesis", "Глава 1 на проверке", "Руководитель получил главу 1.", "/study", 8);
  await notify(p1.id, "deadline", "Срок: статья ВАК 2 из 3", "До срока по индивидуальному плану осталось 60 дней.", "/study", 12);

  // выбор научного руководителя: группа 3УП-01, профили руководителей, student3
  credentials.push(...(await seedSupervision(db)));
  credentials.push(...(await seedAccounts(db)));

  // демо-изменения расписания (после создания студентов — нужны их подгруппы)
  await applyDemoChanges(db, today);

  // ---------- мероприятия МГИМО (снимок открытых анонсов) ----------
  const events = JSON.parse(readFileSync("data/mgimo-events.json", "utf-8")).events as { date: string; time: string | null; place: string | null; title: string; summary: string; url: string }[];
  await db.event.createMany({ data: events.map((e) => ({ ...e, date: new Date(e.date + "T00:00:00Z") })) });

  // ---------- практика: разные сроки у факультетов и направлений (ДОПУЩЕНИЕ — сроки условные) ----------
  const d = (s: string) => new Date(s + "T00:00:00Z");
  const econEn = await db.program.findFirst({ where: { level: "BACHELOR", direction: "Экономика", name: { contains: "International" } } });
  const econ = await db.program.findFirst({ where: { level: "BACHELOR", direction: "Экономика", name: "", facultyLabel: "МЭО" } });
  await db.practicePeriod.createMany({ data: [
    { facultyId: fac["МО"], level: "BACHELOR", course: 1, kind: "Учебная", title: "Ознакомительная практика", startDate: d("2027-06-28"), endDate: d("2027-07-11"), docsDeadline: d("2027-05-20") },
    { facultyId: fac["МО"], level: "BACHELOR", course: 3, kind: "Производственная", title: "Дипломатическая практика (летом после 3 курса)", startDate: d("2027-07-01"), endDate: d("2027-07-28"), docsDeadline: d("2027-05-15") },
    { facultyId: fac["МП"], level: "BACHELOR", course: 3, kind: "Производственная", title: "Правоприменительная практика (февраль 3 курса)", startDate: d("2027-02-01"), endDate: d("2027-02-21"), docsDeadline: d("2026-12-15") },
    { facultyId: fac["МП"], level: "BACHELOR", course: 4, kind: "Преддипломная", title: "Преддипломная практика", startDate: d("2027-03-15"), endDate: d("2027-04-11"), docsDeadline: d("2027-01-31") },
    { facultyId: fac["МЭО"], programId: econ?.id, level: "BACHELOR", course: 3, kind: "Производственная", title: "Практика в банке или компании", startDate: d("2027-06-29"), endDate: d("2027-07-26") },
    { facultyId: fac["МЭО"], programId: econEn?.id, level: "BACHELOR", course: 3, kind: "Производственная", title: "Практика (англоязычная программа) — весенний модуль", startDate: d("2027-04-05"), endDate: d("2027-04-30"), note: "У англоязычной программы свой учебный график" },
    { facultyId: fac["ФУП"], level: "MASTER", course: 2, kind: "Преддипломная", title: "Преддипломная практика магистрантов", startDate: d("2027-02-08"), endDate: d("2027-03-07"), docsDeadline: d("2026-12-20") },
    { facultyId: fac["ФАНК"], level: "POSTGRAD", course: 2, kind: "Педагогическая", title: "Педагогическая практика аспирантов", startDate: d("2027-02-08"), endDate: d("2027-05-31") },
  ] });

  // ---------- сессия: экзамены и консультации текущего семестра (ДОПУЩЕНИЕ — даты условные) ----------
  for (const [enr, gname] of [[s1e, "1МО-01"], [s2e, "4МП-02"], [m1e, "2МагГУ-01"]] as const) {
    const current = await db.grade.findMany({ where: { enrollmentId: enr.id, mark: null, controlType: { not: "CREDIT" } } });
    let day = 11;
    for (const g of current) {
      await db.exam.create({ data: { groupId: grp[gname], discipline: g.discipline, kind: "Консультация", at: new Date(`2027-01-${String(day - 1).padStart(2, "0")}T12:10:00+03:00`), auditorium: "3141", building: "Корпус МО" } });
      await db.exam.create({ data: { groupId: grp[gname], discipline: g.discipline, kind: g.controlType === "EXAM" ? "Экзамен" : "Зачёт с оценкой", at: new Date(`2027-01-${String(day).padStart(2, "0")}T10:00:00+03:00`), auditorium: "зал 2", building: "Корпус МО" } });
      day += 3;
    }
  }

  // ---------- антиплагиат (имитация) ----------
  await db.antiplagiatCheck.create({ data: { enrollmentId: s2e.id, workTitle: "ВКР: Введение", fileName: "vvedenie_v2.docx", fileSize: 48211, status: "DONE", originality: 87, createdAt: daysFrom(-25), checkedAt: daysFrom(-25) } });
  await db.antiplagiatCheck.create({ data: { enrollmentId: s2e.id, workTitle: "ВКР: Глава 1", fileName: "glava1_v1.docx", fileSize: 120554, status: "DONE", originality: 71, createdAt: daysFrom(-4), checkedAt: daysFrom(-4) } });
  await db.antiplagiatCheck.create({ data: { enrollmentId: m1e.id, workTitle: "Курсовая работа", fileName: "kursovaya.docx", fileSize: 90112, status: "DONE", originality: 92, createdAt: daysFrom(-40), checkedAt: daysFrom(-40) } });

  // ---------- вывод учётных данных ----------
  const lines = ["# Тестовые аккаунты (локально, не коммитить)", "", "| Логин | Пароль | Кто |", "|---|---|---|", ...credentials.map(([l, p, w]) => `| ${l} | ${p} | ${w} |`)];
  const credFile = process.env.SEED_CREDENTIALS_FILE || ".demo-accounts.local.md";
  writeFileSync(credFile, lines.join("\n") + "\n", { mode: 0o600 });
  const lessons = await db.lesson.count();
  console.log(`Готово: ${credentials.length} тестовых аккаунтов (пароли в ${credFile}), ${lessons} занятий, ${await db.request.count()} заявок.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
