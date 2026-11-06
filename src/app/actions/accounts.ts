"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Level } from "@prisma/client";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { homeFor, requireUser, type CurrentUser } from "@/lib/auth";
import { accountScope } from "@/lib/access";
import { hashPassword, verifyPassword } from "@/lib/password";
import { baseLogin, generatePassword, parseFio, studentCardNo, uniqueLogin, type Fio } from "@/lib/accounts";
import { readPeopleFile, MAX_ROWS } from "@/lib/bulk-file";

export type Cred = { fio: string; login: string; password: string; note: string };
export type AccState = { error?: string; creds?: Cred[] } | undefined;
export type PreviewRow = { line: number; fio: string; login: string; group: string | null; error: string | null };
export type PreviewState = { error?: string; rows?: PreviewRow[]; batch?: string } | undefined;

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
async function checkBatch(user: CurrentUser, kind: "student" | "postgrad", raw: Record<string, unknown>) {
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

  if (kind === "dean" && user.role === "RECTOR") {
    const facultyId = Number(form.get("facultyId"));
    const fac = await db.faculty.findUnique({ where: { id: facultyId } });
    if (!fac) return { error: "Выберите факультет" };
    const r = await newPerson({ fio, role: "DEAN_OFFICE", createdById: user.id, extra: { staffFacultyId: fac.id } }, reserved);
    revalidatePath("/staff/accounts");
    return { creds: [{ fio: fioText(fio), login: r.login, password: r.password, note: `Деканат: ${fac.name}` }] };
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
    const r = await newPerson({ fio, role: "SUPERVISOR", createdById: user.id, extra: { staffDepartmentId: user.staffDepartmentId } }, reserved);
    await db.supervisorProfile.create({ data: { personId: r.person.id, position: p.data.position, degree: p.data.degree || null, interests: p.data.interests, maxStudents: p.data.maxStudents, levels: ["BACHELOR", "MASTER", "POSTGRAD"] } });
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

export async function previewBulk(_: PreviewState, form: FormData): Promise<PreviewState> {
  const user = await requireUser(["DEAN_OFFICE", "DEPARTMENT"]);
  const kind = user.role === "DEAN_OFFICE" ? "student" : "postgrad";
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
    if (!error && r.group && !groups.some((g) => g.name.toLowerCase() === r.group!.toLowerCase())) error = `Группа «${r.group}» не найдена на факультете`;
    if (f) { seen.add(fioText(f).toLowerCase() + (r.group ?? "")); if (!error) { login = await uniqueLogin(db, baseLogin(f), reserved); reserved.add(login); } }
    rows.push({ line: r.line, fio: f ? fioText(f) : r.fio || "(пусто)", login, group: r.group, error });
  }
  return { rows, batch: JSON.stringify(params) };
}

// ---------- массовая загрузка: шаг 2 — создание ----------

export async function createBulk(_: AccState, form: FormData): Promise<AccState> {
  const user = await requireUser(["DEAN_OFFICE", "DEPARTMENT"]);
  const kind = user.role === "DEAN_OFFICE" ? "student" : "postgrad";
  let params: Record<string, unknown>, rows: { fio: string; group: string | null }[];
  try {
    params = JSON.parse(String(form.get("batch") ?? "{}"));
    rows = z.array(z.object({ fio: z.string().max(200), group: z.string().max(40).nullable() })).max(MAX_ROWS).parse(JSON.parse(String(form.get("rows") ?? "[]")));
  } catch { return { error: "Данные формы повреждены — загрузите файл заново" }; }
  // всё проверяется заново на сервере: клиенту не доверяем
  const batch = await checkBatch(user, kind, params);
  if ("error" in batch) return { error: batch.error };
  const groups = kind === "student" ? await db.group.findMany({ where: { facultyId: user.staffFacultyId! } }) : [];
  const reserved = new Set<string>(); const creds: Cred[] = [];
  for (const r of rows) {
    const f = parseFio(r.fio);
    if (!f) continue;
    const g = r.group ? groups.find((x) => x.name.toLowerCase() === r.group!.toLowerCase()) : undefined;
    if (r.group && !g) continue;
    const c = await createLearner(user, kind, f, batch, g?.id ?? null, reserved);
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
