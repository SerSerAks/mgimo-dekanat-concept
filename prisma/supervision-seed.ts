/**
 * Данные для сценария «Выбор научного руководителя» (SPEC §12). Идемпотентно: можно запускать на заполненной базе.
 * Создаёт группу 3УП-01 из снимка РУЗ, профили руководителей, тестового student3 и примеры заявок.
 * Возвращает созданные учётные записи (логин, пароль), чтобы вызывающий записал их в файл вне git.
 */
import type { Level, PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/password";
import { toMark } from "../src/config/grading";
import { ACADEMIC_YEAR, announceCampaign, loadYearPlan } from "../src/lib/campaigns";

type Cred = [login: string, password: string, who: string];

export async function seedSupervision(db: PrismaClient): Promise<Cred[]> {
  const creds: Cred[] = [];
  const fup = await db.faculty.findUniqueOrThrow({ where: { code: "ФУП" } });
  const polDep = (await db.department.findFirst({ where: { name: "Кафедра сравнительной политологии" } }))
    ?? (await db.department.create({ data: { name: "Кафедра сравнительной политологии", facultyId: fup.id } }));
  const theoryDep = (await db.department.findFirst({ where: { name: "Кафедра политической теории" } }))
    ?? (await db.department.create({ data: { name: "Кафедра политической теории", facultyId: fup.id } }));

  async function person(login: string, role: "STUDENT" | "SUPERVISOR", who: string, data: Record<string, unknown>, listed: boolean) {
    const found = await db.person.findUnique({ where: { login } });
    if (found) return found;
    const password = process.env[`DEMO_PASSWORD_${login.toUpperCase()}`] || randomBytes(9).toString("base64url");
    if (listed) creds.push([login, password, who]);
    return db.person.create({ data: { login, role, passwordHash: await hashPassword(password), ...data } as never });
  }

  // группа 3УП-01 и её расписание из снимка РУЗ (без преподавателей)
  let group = await db.group.findUnique({ where: { name: "3УП-01" } });
  if (!group) {
    const snap = JSON.parse(readFileSync("data/ruz-snapshot.json", "utf-8")).groups["3УП-01"] as { ruzId: number; lessons: Record<string, string | null>[] };
    group = await db.group.create({ data: { name: "3УП-01", ruzId: snap.ruzId, level: "BACHELOR", course: 3, facultyId: fup.id } });
    const teachers = new Map((await db.lesson.findMany({ where: { teacherId: { not: null } }, select: { discipline: true, teacherId: true }, distinct: ["discipline"] })).map((l) => [l.discipline, l.teacherId!]));
    const NAMES = ["Тихонова Е. А.", "Громов П. С.", "Ершова Д. И.", "Карпов М. О.", "Соколова А. П.", "Беляев К. И."];
    let i = 0;
    for (const l of snap.lessons) {
      if (!teachers.has(l.discipline!)) teachers.set(l.discipline!, (await db.teacher.create({ data: { name: NAMES[i++ % NAMES.length], title: "доцент" } })).id);
    }
    await db.lesson.createMany({ data: snap.lessons.map((l) => ({
      groupId: group!.id, date: new Date(l.date + "T00:00:00Z"), start: l.beginLesson!, end: l.endLesson!, discipline: l.discipline!,
      kind: l.kindOfWork ?? "", auditorium: l.auditorium ?? "", building: l.building ?? "", subgroup: l.subGroup, teacherId: teachers.get(l.discipline!)!,
    })) });
  }
  const sub = (await db.lesson.findFirst({ where: { groupId: group.id, subgroup: { startsWith: "01-" } } }))?.subgroup ?? null;

  // руководители и их профили
  const sup1 = await db.person.findUniqueOrThrow({ where: { login: "supervisor1" } });
  const sup2 = await person("sup_fup_pol", "SUPERVISOR", "", { lastName: "Миронова", firstName: "Алиса", middleName: "Игоревна", staffDepartmentId: polDep.id }, false);
  const sup3 = await person("sup_fup_theory", "SUPERVISOR", "", { lastName: "Орлов", firstName: "Кирилл", middleName: "Павлович", staffDepartmentId: theoryDep.id }, false);
  const supMp = await db.person.findUnique({ where: { login: "supervisor_mp" } });
  const profiles = [
    { personId: sup1.id, position: "доцент", degree: "канд. полит. наук", interests: "государственное управление, госкорпорации, проектное управление в органах власти", maxStudents: 5, levels: ["BACHELOR", "MASTER", "POSTGRAD"] },
    { personId: sup2.id, position: "профессор", degree: "д-р полит. наук", interests: "сравнительная политология, избирательные системы, политика стран Латинской Америки", maxStudents: 3, levels: ["BACHELOR", "MASTER"] },
    { personId: sup3.id, position: "доцент", degree: "канд. филос. наук", interests: "политическая теория, концепции суверенитета, история политических идей", maxStudents: 1, levels: ["BACHELOR"] },
    ...(supMp ? [{ personId: supMp.id, position: "доцент", degree: "канд. юрид. наук", interests: "иммунитет государства, международное частное право, суверенные долги", maxStudents: 4, levels: ["BACHELOR", "MASTER"] }] : []),
  ] as const;
  for (const p of profiles) await db.supervisorProfile.upsert({ where: { personId: p.personId }, create: { ...p, levels: [...p.levels] as Level[] }, update: {} });

  // student3 — тестовый аккаунт жюри: 3 курс ФУП, без руководителя
  const gmu = await db.program.findFirst({ where: { level: "BACHELOR", direction: "Государственное и муниципальное управление" } });
  const s3 = await person("student3", "STUDENT", "Бакалавр, 3 курс ФУП, группа 3УП-01 — выбирает научного руководителя", { lastName: "Комарова", firstName: "Дарья", middleName: "Олеговна", avatarColor: "#0447A0" }, true);
  if (!(await db.enrollment.findFirst({ where: { personId: s3.id } }))) {
    const e = await db.enrollment.create({ data: {
      personId: s3.id, level: "BACHELOR", facultyId: fup.id, groupId: group.id, course: 3, programId: gmu?.id, languageSubgroup: sub,
      studentCardNo: "24-ФУП-0301", startDate: new Date("2024-09-01"),
    } });
    const g = async (semester: number, discipline: string, controlType: "EXAM" | "CREDIT" | "GRADED_CREDIT", score: number, current = false) => db.grade.create({ data: {
      enrollmentId: e.id, semester, discipline, controlType, score,
      mark: current ? null : controlType === "CREDIT" ? (score >= 60 ? "зачтено" : "не зачтено") : toMark(score).mark,
      ects: current || controlType === "CREDIT" ? null : toMark(score).ects,
      components: [{ name: "Работа на семинарах", max: 30, score: Math.round(score * 0.3) }, { name: "Контрольные", max: 30, score: Math.round(score * 0.3) }, { name: "Экзамен", max: 40, score: current ? null : score - 2 * Math.round(score * 0.3) }],
    } });
    await g(4, "Теория государственного управления", "EXAM", 91); await g(4, "Политическая социология", "EXAM", 84); await g(4, "английский второй", "GRADED_CREDIT", 88);
    await g(5, "Государственная политика и управление", "EXAM", 52, true); await g(5, "Проектное управление", "EXAM", 49, true);
  }

  // массовка: студент ФУП с ожидающей заявкой к supervisor1 и студент, уже взятый sup3 (у него мест больше нет)
  async function extra(login: string, course: number) {
    const p = await person(login, "STUDENT", "", { lastName: course === 4 ? "Зайцев" : "Лебедева", firstName: course === 4 ? "Егор" : "Полина", middleName: course === 4 ? "Андреевич" : "Сергеевна" }, false);
    return (await db.enrollment.findFirst({ where: { personId: p.id } })) ?? db.enrollment.create({ data: {
      personId: p.id, level: "BACHELOR", facultyId: fup.id, groupId: course === 3 ? group!.id : null, course, programId: gmu?.id, studentCardNo: `2${5 - course}-ФУП-03${course}9`, startDate: new Date(`20${27 - course}-09-01`),
    } });
  }
  const pendingStudent = await extra("demo_fup_3", 3);
  if (!(await db.supervisorRequest.findFirst({ where: { enrollmentId: pendingStudent.id } }))) {
    await db.supervisorRequest.create({ data: { enrollmentId: pendingStudent.id, supervisorId: sup1.id, topic: "Цифровые платформы в предоставлении государственных услуг", message: "Пишу курсовую про Госуслуги, хочу развить тему в ВКР. Готова к еженедельным встречам." } });
  }
  const takenStudent = await extra("demo_fup_4", 4);
  if (!takenStudent.supervisorId) {
    await db.enrollment.update({ where: { id: takenStudent.id }, data: { supervisorId: sup3.id } });
    await db.supervisorRequest.create({ data: { enrollmentId: takenStudent.id, supervisorId: sup3.id, topic: "Концепция суверенитета у Ж. Бодена", message: "Интересуюсь историей политических идей.", status: "ACCEPTED", decidedAt: new Date(), reply: "Берусь, тема хорошая." } });
  }
  // факультет МО: руководители и студенты 2 курса — чтобы dean_mo мог загрузить план и увидеть, как расходятся уведомления
  const mo = await db.faculty.findUniqueOrThrow({ where: { code: "МО" } });
  const dipDep = await db.department.findFirstOrThrow({ where: { name: "Кафедра дипломатии" } });
  const moSups = [
    await person("sup_mo_dip", "SUPERVISOR", "", { lastName: "Воронцова", firstName: "Вероника", middleName: "Андреевна", staffDepartmentId: dipDep.id }, false),
    await person("sup_mo_reg", "SUPERVISOR", "", { lastName: "Громов", firstName: "Никита", middleName: "Олегович", staffDepartmentId: dipDep.id }, false),
  ];
  const moInterests = ["дипломатический протокол, многосторонняя дипломатия, ООН", "регионоведение, страны Азиатско-Тихоокеанского региона, Япония"];
  for (const [i, sp] of moSups.entries()) await db.supervisorProfile.upsert({ where: { personId: sp.id }, create: { personId: sp.id, position: "доцент", degree: "канд. ист. наук", interests: moInterests[i], maxStudents: 6, levels: ["BACHELOR", "MASTER"] }, update: {} });
  const moProg = await db.program.findFirst({ where: { level: "BACHELOR", direction: "Зарубежное регионоведение" } });
  for (let i = 1; i <= 3; i++) {
    const p2 = await person(`demo_mo2_${i}`, "STUDENT", "", { lastName: ["Орлова", "Беляев", "Соколова"][i - 1], firstName: ["Ева", "Матвей", "Анна"][i - 1], middleName: ["Павловна", "Игоревич", "Сергеевна"][i - 1] }, false);
    if (!(await db.enrollment.findFirst({ where: { personId: p2.id } }))) {
      await db.enrollment.create({ data: { personId: p2.id, level: "BACHELOR", facultyId: mo.id, course: 2, programId: moProg?.id, studentCardNo: `25-МО-020${i}`, startDate: new Date("2025-09-01") } });
    }
  }

  // учебный план ФУП загружен: кампании + первые уведомления (SPEC §13). План МО НЕ загружаем — это демо-действие для dean_mo

  await loadYearPlan(db, fup.id);
  const camp = (course: number, workType: "COURSEWORK" | "THESIS") => db.supervisionCampaign.findFirstOrThrow({ where: { facultyId: fup.id, programId: null, level: "BACHELOR", course, workType, academicYear: ACADEMIC_YEAR } });
  const cw3 = await camp(3, "COURSEWORK"), th4 = await camp(4, "THESIS");
  // приём открыли двое; sup_fup_theory — нет (ему придёт напоминание)
  for (const [sid, cid, slots] of [[sup1.id, cw3.id, 4], [sup2.id, cw3.id, 2], [sup1.id, th4.id, 2], [sup3.id, th4.id, 1]] as const) {
    await db.supervisorIntake.upsert({ where: { supervisorId_campaignId: { supervisorId: sid, campaignId: cid } }, create: { supervisorId: sid, campaignId: cid, slots }, update: {} });
  }
  // НИР загружают кафедры (правка 06.11): прежние НИР деканата без заявок убираем, с заявками — передаём кафедре факультета
  for (const old of await db.supervisionCampaign.findMany({ where: { workType: "NIR", departmentId: null }, include: { _count: { select: { requests: true } } } })) {
    if (old._count.requests === 0) {
      await db.supervisorIntake.deleteMany({ where: { campaignId: old.id } });
      await db.supervisionCampaign.delete({ where: { id: old.id } });
    } else {
      const dep = await db.department.findFirst({ where: { facultyId: old.facultyId, staff: { some: { role: "SUPERVISOR" } } } });
      if (dep) await db.supervisionCampaign.update({ where: { id: old.id }, data: { departmentId: dep.id } });
    }
  }
  // демо: кафедра государственного управления уже загрузила НИР магистрантам 1 курса
  const govDep = await db.department.findFirst({ where: { name: "Кафедра государственного управления" } });
  if (govDep) {
    const nir = { facultyId: govDep.facultyId, departmentId: govDep.id, programId: null, level: "MASTER" as const, course: 1, workType: "NIR" as const, academicYear: ACADEMIC_YEAR };
    if (!(await db.supervisionCampaign.findFirst({ where: nir }))) {
      const c = await db.supervisionCampaign.create({ data: { ...nir, openBy: new Date("2026-11-16T00:00:00Z"), chooseBy: new Date("2026-11-30T00:00:00Z") } });
      await announceCampaign(db, c);
    }
  }

  // заявки без кампании (созданные до §13) — привязываем к кампании по курсу и виду работы
  const legacy = await db.supervisorRequest.findMany({ where: { campaignId: null }, include: { enrollment: true } });
  for (const r of legacy) {
    const e = r.enrollment;
    const c = await db.supervisionCampaign.findFirst({ where: { facultyId: e.facultyId, level: e.level, course: e.course, academicYear: ACADEMIC_YEAR, workType: e.level === "BACHELOR" && e.course < 4 ? "COURSEWORK" : "THESIS" } });
    if (!c) continue;
    await db.supervisorRequest.update({ where: { id: r.id }, data: { campaignId: c.id } });
    // курсовая не закрепляет руководителя ВКР: откатываем закрепление, сделанное по старой логике
    if (c.workType === "COURSEWORK" && r.status === "ACCEPTED" && e.supervisorId === r.supervisorId) {
      await db.enrollment.update({ where: { id: e.id }, data: { supervisorId: null } });
      await db.thesis.deleteMany({ where: { enrollmentId: e.id, stage: { lte: 2 } } });
    }
  }
  return creds;
}
