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
  return creds;
}
