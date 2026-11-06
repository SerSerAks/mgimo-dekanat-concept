"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Level, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { homeFor, requireUser, type CurrentUser } from "@/lib/auth";
import { accountScope } from "@/lib/access";
import { hashPassword, verifyPassword } from "@/lib/password";
import { baseLogin, generatePassword, parseFio, studentCardNo, uniqueLogin, type Fio } from "@/lib/accounts";
import { readPeopleFile, MAX_ROWS } from "@/lib/bulk-file";

export type Cred = { fio: string; login: string; password: string; note: string };
export type AccState = { error?: string; creds?: Cred[] } | undefined;
export type PreviewRow = { line: number; fio: string; login: string; group: string | null; position: string | null; degree: string | null; error: string | null };
export type PreviewState = { error?: string; rows?: PreviewRow[]; batch?: string } | undefined;

type BulkKind = "student" | "postgrad" | "supervisor";
const fioText = (f: Fio) => `${f.lastName} ${f.firstName}${f.middleName ? " " + f.middleName : ""}`;
const ACADEMIC_START = 2026; // 2026/27 учебный год

async function newPerson(data: { fio: Fio; role: "STUDENT" | "DEAN_OFFICE" | "DEPARTMENT" | "SUPERVISOR"; createdById: string; extra?: object }, reserved: Set<string>) {
  const login = await uniqueLogin(db, baseLogin(data.fio), reserved);
  reserved.add(login);
  const password = generatePassword();
  const person = await db.person.create({ data: {
    login, role: data.role, passwordHash: await hashPassword(password), mustChangePassword: true, createdById: data.createdById,
    ...data.fio, ...(data.extra ?? {}),
  } });
  return { person, login, password };
}

// ---------- параметры партии студентов / аспирантов ----------

const StudentBatch = z.object({
  level: z.enum(["BACHELOR", "MASTER"]),
  course: z.coerce.number().int().min(1).max(6),
  programId: z.union([z.literal(""), z.coerce.number().int()]),
  groupId: z.union([z.literal(""), z.coerce.number().int()]),
});
const PostgradBatch = z.object({
  course: z.coerce.number().int().min(1).max(4),
  programId: z.union([z.literal(""), z.coerce.number().int()]),
});

/** Проверка параметров партии в области доступа создателя. */
async function checkBatch(user: CurrentUser, kind: BulkKind, raw: Record<string, unknown>) {
  if (kind === "supervisor") {
    if (user.role !== "DEPARTMENT" || user.staffDepartmentId == null) return { error: "Преподавателей создаёт кафедра" } as const;
    const b = z.object({ maxStudents: z.coerce.number().int().min(0).max(15) }).safeParse(raw);
    if (!b.success) return { error: "Укажите, сколько студентов может вести преподаватель (0–15)" } as const;
    return { supervisor: b.data } as const;
  }
  if (kind === "student") {
    if (user.role !== "DEAN_OFFICE" || user.staffFacultyId == null) return { error: "Студентов создаёт деканат" } as const;
    const b = StudentBatch.safeParse(raw);
    if (!b.success) return { error: "Проверьте уровень, курс, направление" } as const;
    if (b.data.programId !== "" && !(await db.program.findFirst({ where: { id: b.data.programId, level: b.data.level, facultyId: user.staffFacultyId } }))) return { error: "Направление не вашего факультета" } as const;
    if (b.data.groupId !== "" && !(await db.group.findFirst({ where: { id: b.data.groupId, facultyId: user.staffFacultyId } }))) return { error: "Группа не вашего факультета" } as const;
    return { student: b.data } as const;
  }
  if (user.role !== "DEPARTMENT" || user.staffDepartmentId == null) return { error: "Аспирантов создаёт кафедра" } as const;
  const b = PostgradBatch.safeParse(raw);
  if (!b.success) return { error: "Проверьте год обучения и специальность" } as const;
  if (b.data.programId !== "" && !(await db.program.findFirst({ where: { id: b.data.programId, level: "POSTGRAD" } }))) return { error: "Неизвестная специальность" } as const;
  return { postgrad: b.data } as const;
}

type TeacherCard = { position: string | null; degree: string | null; interests?: string; maxStudents: number };

/** Карточка преподавателя кафедры: аккаунт SUPERVISOR + профиль научного руководителя. */
async function createTeacher(user: CurrentUser, fio: Fio, card: TeacherCard, reserved: Set<string>) {
  const r = await newPerson({ fio, role: "SUPERVISOR", createdById: user.id, extra: { staffDepartmentId: user.staffDepartmentId } }, reserved);
  await db.supervisorProfile.create({ data: {
    personId: r.person.id, position: card.position || "преподаватель", degree: card.degree || null, interests: card.interests ?? "",
    maxStudents: card.maxStudents, levels: ["BACHELOR", "MASTER", "POSTGRAD"],
  } });
  return r;
}

async function createLearner(user: CurrentUser, kind: "student" | "postgrad", fio: Fio, batch: Awaited<ReturnType<typeof checkBatch>>, groupId: number | null, reserved: Set<string>) {
  if ("error" in batch) throw new Error(batch.error);
  if (kind === "student" && batch.student) {
    const b = batch.student;
    const fac = await db.faculty.findUniqueOrThrow({ where: { id: user.staffFacultyId! } });
    const { person, login, password } = await newPerson({ fio, role: "STUDENT", createdById: user.id }, reserved);
    const start = ACADEMIC_START - b.course + 1;
    await db.enrollment.create({ data: {
      personId: person.id, level: b.level as Level, course: b.course, facultyId: fac.id, groupId: groupId ?? (b.groupId === "" ? null : b.groupId),
      programId: b.programId === "" ? null : b.programId, studentCardNo: studentCardNo(start, fac.code), startDate: new Date(`${start}-09-01`),
    } });
    return { login, password };
  }
  const b = batch.postgrad!;
  const fank = await db.faculty.findUnique({ where: { code: "ФАНК" } });
  const dep = await db.department.findUniqueOrThrow({ where: { id: user.staffDepartmentId! } });
  const { person, login, password } = await newPerson({ fio, role: "STUDENT", createdById: user.id }, reserved);
  const start = ACADEMIC_START - b.course + 1;
  await db.enrollment.create({ data: {
    personId: person.id, level: "POSTGRAD", course: b.course, facultyId: fank?.id ?? dep.facultyId, departmentId: dep.id,
    programId: b.programId === "" ? null : b.programId, studentCardNo: studentCardNo(start, "ФАНК"), startDate: new Date(`${start}-10-01`),
  } });
  return { login, password };
}

// ---------- создание по одному ----------

export async function createAccount(_: AccState, form: FormData): Promise<AccState> {
  const user = await requireUser(["RECTOR", "DEAN_OFFICE", "DEPARTMENT"]);
  const kind = String(form.get("kind") ?? "");
  const fio = parseFio(String(form.get("fio") ?? ""));
  if (!fio) return { error: "Введите ФИО полностью: Фамилия Имя Отчество" };
  const reserved = new Set<string>();

  // карточка сотрудника деканата — видна студентам в «Мой деканат» (SPEC §15)
  const card = z.object({
    position: z.string().trim().max(80).optional(), duties: z.string().trim().max(300).optional(),
    staffRoom: z.string().trim().max(60).optional(), staffHours: z.string().trim().max(80).optional(), workPhone: z.string().trim().max(40).optional(),
  }).parse(Object.fromEntries(form));
  const cardData = { staffDuties: card.duties || null, staffRoom: card.staffRoom || null, staffHours: card.staffHours || null, workPhone: card.workPhone || null };

  if (kind === "dean" && user.role === "RECTOR") {
    const facultyId = Number(form.get("facultyId"));
    const fac = await db.faculty.findUnique({ where: { id: facultyId } });
    if (!fac) return { error: "Выберите факультет" };
    const busy = await db.person.findFirst({ where: { role: "DEAN_OFFICE", isHead: true, staffFacultyId: fac.id } });
    if (busy) return { error: `У факультета уже есть декан — ${busy.lastName} ${busy.firstName}${busy.middleName ? " " + busy.middleName : ""}. Двух деканов быть не может: сначала измените или удалите анкету текущего декана в списке ниже.` };
    // проректор вводит только ФИО и факультет; карточку для студентов декан заполнит сам
    const r = await newPerson({ fio, role: "DEAN_OFFICE", createdById: user.id, extra: { staffFacultyId: fac.id, isHead: true, position: "Декан факультета" } }, reserved);
    // сотрудники, оставшиеся без руководителя (после удаления прежнего декана), переходят к новому
    await db.person.updateMany({ where: { role: "DEAN_OFFICE", staffFacultyId: fac.id, isHead: false, managerId: null }, data: { managerId: r.person.id } });
    revalidatePath("/staff/accounts");
    return { creds: [{ fio: fioText(fio), login: r.login, password: r.password, note: `Декан: ${fac.name}` }] };
  }
  if (kind === "staff" && user.role === "DEAN_OFFICE" && user.staffFacultyId != null) {
    if (!card.position || card.position.length < 3) return { error: "Укажите должность" };
    // руководитель — сам создатель или сотрудник из его области управления
    const managerId = String(form.get("managerId") || user.id);
    if (managerId !== user.id && !(await db.person.findFirst({ where: { AND: [{ id: managerId, role: "DEAN_OFFICE" }, accountScope(user)] } }))) return { error: "Такого руководителя выбрать нельзя" };
    const r = await newPerson({ fio, role: "DEAN_OFFICE", createdById: user.id, extra: { staffFacultyId: user.staffFacultyId, position: card.position, managerId, ...cardData } }, reserved);
    revalidatePath("/staff/accounts");
    return { creds: [{ fio: fioText(fio), login: r.login, password: r.password, note: card.position }] };
  }
  if (kind === "department" && user.role === "DEAN_OFFICE" && user.staffFacultyId != null) {
    const depId = String(form.get("departmentId") ?? "");
    const newName = z.string().trim().max(160).parse(String(form.get("departmentName") ?? ""));
    let dep = depId ? await db.department.findFirst({ where: { id: Number(depId), facultyId: user.staffFacultyId } }) : null;
    if (!dep && newName.length >= 5) dep = await db.department.create({ data: { name: newName, facultyId: user.staffFacultyId } });
    if (!dep) return { error: "Выберите кафедру или впишите название новой" };
    const r = await newPerson({ fio, role: "DEPARTMENT", createdById: user.id, extra: { staffDepartmentId: dep.id } }, reserved);
    revalidatePath("/staff/accounts");
    return { creds: [{ fio: fioText(fio), login: r.login, password: r.password, note: dep.name }] };
  }
  if (kind === "supervisor" && user.role === "DEPARTMENT" && user.staffDepartmentId != null) {
    const p = z.object({ position: z.string().trim().min(3).max(60), degree: z.string().trim().max(60), interests: z.string().trim().min(5).max(300), maxStudents: z.coerce.number().int().min(1).max(15) }).safeParse(Object.fromEntries(form));
    if (!p.success) return { error: "Заполните должность и научные интересы" };
    const r = await createTeacher(user, fio, { position: p.data.position, degree: p.data.degree || null, interests: p.data.interests, maxStudents: p.data.maxStudents }, reserved);
    revalidatePath("/staff/accounts");
    return { creds: [{ fio: fioText(fio), login: r.login, password: r.password, note: "Преподаватель кафедры (научный руководитель)" }] };
  }
  if (kind === "student" || kind === "postgrad") {
    const batch = await checkBatch(user, kind, Object.fromEntries(form));
    if ("error" in batch) return { error: batch.error };
    const r = await createLearner(user, kind, fio, batch, null, reserved);
    revalidatePath("/staff/accounts");
    return { creds: [{ fio: fioText(fio), login: r.login, password: r.password, note: kind === "student" ? "Студент" : "Аспирант" }] };
  }
  return { error: "Этот вид аккаунта вам создавать нельзя" };
}

// ---------- массовая загрузка: шаг 1 — проверка ----------

function bulkKind(user: CurrentUser, form: FormData): BulkKind {
  if (user.role === "DEAN_OFFICE") return "student";
  return form.get("kind") === "supervisor" ? "supervisor" : "postgrad";
}

export async function previewBulk(_: PreviewState, form: FormData): Promise<PreviewState> {
  const user = await requireUser(["DEAN_OFFICE", "DEPARTMENT"]);
  const kind = bulkKind(user, form);
  const params = Object.fromEntries([...form.entries()].filter(([k]) => k !== "file"));
  const batch = await checkBatch(user, kind, params);
  if ("error" in batch) return { error: batch.error };
  const file = form.get("file");
  if (!(file instanceof File)) return { error: "Прикрепите файл со списком" };
  const parsed = await readPeopleFile(file);
  if ("error" in parsed) return { error: parsed.error };

  const groups = kind === "student" ? await db.group.findMany({ where: { facultyId: user.staffFacultyId! } }) : [];
  const reserved = new Set<string>(); const seen = new Set<string>();
  const rows: PreviewRow[] = [];
  for (const r of parsed.rows) {
    const f = parseFio(r.fio);
    let error: string | null = null, login = "";
    if (!f) error = "ФИО не распознано — нужно «Фамилия Имя Отчество»";
    else if (seen.has(fioText(f).toLowerCase() + (r.group ?? ""))) error = "Повтор в файле";
    if (!error && kind === "student" && r.group && !groups.some((g) => g.name.toLowerCase() === r.group!.toLowerCase())) error = `Группа «${r.group}» не найдена на факультете`;
    if (f) { seen.add(fioText(f).toLowerCase() + (r.group ?? "")); if (!error) { login = await uniqueLogin(db, baseLogin(f), reserved); reserved.add(login); } }
    rows.push({ line: r.line, fio: f ? fioText(f) : r.fio || "(пусто)", login, group: kind === "student" ? r.group : null, position: r.position, degree: r.degree, error });
  }
  return { rows, batch: JSON.stringify(params) };
}

// ---------- массовая загрузка: шаг 2 — создание ----------

export async function createBulk(_: AccState, form: FormData): Promise<AccState> {
  const user = await requireUser(["DEAN_OFFICE", "DEPARTMENT"]);
  const kind = bulkKind(user, form);
  let params: Record<string, unknown>, rows: { fio: string; group: string | null; position: string | null; degree: string | null }[];
  try {
    params = JSON.parse(String(form.get("batch") ?? "{}"));
    const opt = z.string().trim().max(60).nullable().default(null);
    rows = z.array(z.object({ fio: z.string().max(200), group: z.string().max(40).nullable(), position: opt, degree: opt })).max(MAX_ROWS).parse(JSON.parse(String(form.get("rows") ?? "[]")));
  } catch { return { error: "Данные формы повреждены — загрузите файл заново" }; }
  // всё проверяется заново на сервере: клиенту не доверяем
  const batch = await checkBatch(user, kind, params);
  if ("error" in batch) return { error: batch.error };
  const groups = kind === "student" ? await db.group.findMany({ where: { facultyId: user.staffFacultyId! } }) : [];
  const reserved = new Set<string>(); const creds: Cred[] = [];
  for (const r of rows) {
    const f = parseFio(r.fio);
    if (!f) continue;
    if (kind === "supervisor" && "supervisor" in batch && batch.supervisor) {
      const t = await createTeacher(user, f, { position: r.position, degree: r.degree, maxStudents: batch.supervisor.maxStudents }, reserved);
      creds.push({ fio: fioText(f), login: t.login, password: t.password, note: r.position || "преподаватель" });
      continue;
    }
    if (kind === "supervisor") continue;
    const g = r.group ? groups.find((x) => x.name.toLowerCase() === r.group!.toLowerCase()) : undefined;
    if (r.group && !g) continue;
    const c = await createLearner(user, kind as "student" | "postgrad", f, batch, g?.id ?? null, reserved);
    creds.push({ fio: fioText(f), login: c.login, password: c.password, note: g?.name ?? "" });
  }
  revalidatePath("/staff/accounts");
  return creds.length ? { creds } : { error: "Нет строк без ошибок — создавать нечего" };
}

// ---------- сброс пароля подчинённому аккаунту ----------

export async function resetPassword(_: AccState, form: FormData): Promise<AccState> {
  const user = await requireUser(["RECTOR", "DEAN_OFFICE", "DEPARTMENT"]);
  const id = String(form.get("id") ?? "");
  const p = await db.person.findFirst({ where: { AND: [{ id }, accountScope(user)] } }); // чужой аккаунт = «не найден»
  if (!p) return { error: "Аккаунт не найден" };
  const password = generatePassword();
  await db.$transaction([
    db.person.update({ where: { id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } }),
    db.session.deleteMany({ where: { personId: id } }), // старые входы завершаются
  ]);
  return { creds: [{ fio: `${p.lastName} ${p.firstName}${p.middleName ? " " + p.middleName : ""}`, login: p.login, password, note: "Пароль сброшен" }] };
}

// ---------- правка анкеты ----------

export type EditState = { error?: string; ok?: string } | undefined;
const t = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

/**
 * Правка анкеты подчинённого аккаунта (или своей карточки сотрудника деканата).
 * Кого можно править — та же область accountScope, что и для сброса пароля. Логин не меняется.
 */
export async function updateAccount(_: EditState, form: FormData): Promise<EditState> {
  const user = await requireUser(["RECTOR", "DEAN_OFFICE", "DEPARTMENT"]);
  const id = String(form.get("id") ?? "");
  const self = id === user.id && user.role === "DEAN_OFFICE";
  const p = self ? await db.person.findUnique({ where: { id } }) : await db.person.findFirst({ where: { AND: [{ id }, accountScope(user)] } });
  if (!p) return { error: "Аккаунт не найден" };

  let fio: Fio | null = null;
  if (!self) {
    fio = parseFio(String(form.get("fio") ?? ""));
    if (!fio) return { error: "Введите ФИО полностью: Фамилия Имя Отчество" };
  }

  // декан — проректор меняет ФИО и факультет
  if (user.role === "RECTOR") {
    const facultyId = Number(form.get("facultyId"));
    const fac = await db.faculty.findUnique({ where: { id: facultyId } });
    if (!fac) return { error: "Выберите факультет" };
    if (fac.id !== p.staffFacultyId) {
      const busy = await db.person.findFirst({ where: { role: "DEAN_OFFICE", isHead: true, staffFacultyId: fac.id, id: { not: id } } });
      if (busy) return { error: `У этого факультета уже есть декан — ${busy.lastName} ${busy.firstName}. Сначала измените или удалите анкету текущего декана.` };
    }
    await db.$transaction([
      // подчинённые остаются на прежнем факультете и ждут нового декана
      ...(fac.id !== p.staffFacultyId ? [db.person.updateMany({ where: { managerId: id }, data: { managerId: null } })] : []),
      db.person.update({ where: { id }, data: { ...fio!, staffFacultyId: fac.id } }),
    ]);
    revalidatePath("/staff/accounts");
    return { ok: "Анкета сохранена" };
  }

  // сотрудник деканата: должность, место в структуре, карточка для студентов
  if (p.role === "DEAN_OFFICE") {
    const c = z.object({ position: t(80), duties: t(300), staffRoom: t(60), staffHours: t(80), workPhone: t(40) }).parse(Object.fromEntries(form));
    const data: Prisma.PersonUpdateInput = { staffDuties: c.duties, staffRoom: c.staffRoom, staffHours: c.staffHours, workPhone: c.workPhone };
    if (!self) {
      Object.assign(data, fio);
      if (!p.isHead) {
        if (!c.position || c.position.length < 3) return { error: "Укажите должность" };
        data.position = c.position;
        const managerId = String(form.get("managerId") || "");
        if (managerId && managerId !== p.managerId) {
          if (managerId === id) return { error: "Сотрудник не может подчиняться сам себе" };
          const ok = managerId === user.id || (await db.person.findFirst({ where: { AND: [{ id: managerId, role: "DEAN_OFFICE" }, accountScope(user)] } }));
          if (!ok) return { error: "Такого руководителя выбрать нельзя" };
          // нельзя поставить человека под его же подчинённого — получится петля
          for (let cur: string | null = managerId; cur; cur = (await db.person.findUnique({ where: { id: cur }, select: { managerId: true } }))?.managerId ?? null) {
            if (cur === id) return { error: "Нельзя подчинить сотрудника его же подчинённому" };
          }
          data.manager = { connect: { id: managerId } };
        }
      }
    }
    await db.person.update({ where: { id }, data });
    revalidatePath("/staff/accounts"); revalidatePath("/dekanat");
    return { ok: "Анкета сохранена" };
  }

  // преподаватель кафедры: ФИО и профиль научного руководителя
  if (p.role === "SUPERVISOR") {
    const c = z.object({ position: z.string().trim().min(3).max(60), degree: t(60), interests: z.string().trim().max(300).default(""), maxStudents: z.coerce.number().int().min(0).max(15) }).safeParse(Object.fromEntries(form));
    if (!c.success) return { error: "Проверьте должность и число студентов (0–15)" };
    await db.$transaction([
      db.person.update({ where: { id }, data: fio! }),
      db.supervisorProfile.upsert({ where: { personId: id }, update: c.data, create: { personId: id, ...c.data, levels: ["BACHELOR", "MASTER", "POSTGRAD"] } }),
    ]);
    revalidatePath("/staff/accounts");
    return { ok: "Анкета сохранена" };
  }

  // остальные (кафедра, студенты) — только ФИО
  await db.person.update({ where: { id }, data: fio! });
  revalidatePath("/staff/accounts");
  return { ok: "Анкета сохранена" };
}

// ---------- удаление анкеты декана (проректор) ----------

export async function deleteDean(_: EditState, form: FormData): Promise<EditState> {
  const user = await requireUser(["RECTOR"]);
  const id = String(form.get("id") ?? "");
  const p = await db.person.findFirst({ where: { AND: [{ id }, accountScope(user)] } });
  if (!p) return { error: "Аккаунт не найден" };
  // подчинённые и созданные аккаунты не удаляются: подчинённые переходят к следующему декану факультета
  const unlink = [
    db.person.updateMany({ where: { managerId: id }, data: { managerId: null } }),
    db.person.updateMany({ where: { createdById: id }, data: { createdById: null } }),
    db.session.deleteMany({ where: { personId: id } }),
  ];
  try {
    await db.$transaction([...unlink, db.person.delete({ where: { id } })]);
  } catch {
    // у декана есть история (объявления, решения по заявкам) — её не стираем, аккаунт закрываем:
    // снимаем с должности, отвязываем от факультета, пароль больше не подходит
    await db.$transaction([...unlink, db.person.update({ where: { id }, data: {
      isHead: false, staffFacultyId: null, position: "Бывший декан", passwordHash: await hashPassword(generatePassword(32)), mustChangePassword: false,
    } })]);
  }
  revalidatePath("/staff/accounts");
  return { ok: "Анкета удалена — можно назначить нового декана" };
}

// ---------- смена своего пароля ----------

export type PwState = { error?: string } | undefined;

export async function changeOwnPassword(_: PwState, form: FormData): Promise<PwState> {
  const user = await requireUser(undefined, { allowPasswordChange: true });
  const current = String(form.get("current") ?? ""), next = String(form.get("next") ?? ""), repeat = String(form.get("repeat") ?? "");
  const me = await db.person.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(me.passwordHash, current))) return { error: "Текущий пароль неверный" };
  if (next.length < 10) return { error: "Новый пароль — не короче 10 символов" };
  if (next !== repeat) return { error: "Пароли не совпадают" };
  if (next === current) return { error: "Новый пароль должен отличаться от выданного" };
  if (next.toLowerCase().includes(me.login.toLowerCase())) return { error: "Пароль не должен содержать логин" };
  await db.person.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false } });
  redirect(homeFor(user.role));
}
