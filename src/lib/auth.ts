import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { db } from "./db";

const COOKIE = "dk_session";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// Токен живёт только в httpOnly-cookie; в БД — его sha256. Утечка БД не даёт войти чужой сессией.
export async function createSession(personId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  // кабинет открывается с той должностью, с которой человек работал в прошлый раз (если она ещё есть)
  const p = await db.person.findUnique({ where: { id: personId }, select: { lastAppointmentId: true } });
  const last = p?.lastAppointmentId ? await db.appointment.findFirst({ where: { id: p.lastAppointmentId, personId }, select: { id: true } }) : null;
  const session = await db.session.create({ data: { id: sha256(token), personId, expiresAt, appointmentId: last?.id ?? null }, include: { appointment: { select: { role: true } } } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return session.appointment?.role ?? null; // роль дополнительной должности, если кабинет откроется с неё
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
}

export type StaffRole = { id: string | null; role: Role; unit: string | null; position: string | null };

/** Переключить активную должность в текущей сессии. id = null — основная. Чужая должность не найдётся. */
export async function switchRole(appointmentId: string | null) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (appointmentId && !user.roles.some((r) => r.id === appointmentId)) return null;
  await db.$transaction([
    db.session.update({ where: { id: user.sessionId }, data: { appointmentId } }),
    db.person.update({ where: { id: user.id }, data: { lastAppointmentId: appointmentId } }),
  ]);
  return user.roles.find((r) => r.id === appointmentId) ?? null;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// Текущий пользователь — единственный источник «кто я» для всего приложения. Кешируется на запрос.
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: {
      person: {
        select: {
          id: true, login: true, role: true, lastName: true, firstName: true, middleName: true,
          avatarColor: true, staffFacultyId: true, staffDepartmentId: true, mustChangePassword: true, isHead: true, position: true,
          staffFaculty: { select: { name: true } }, staffDepartment: { select: { name: true } },
          appointments: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, staffDepartmentId: true, staffDepartment: { select: { name: true } } } },
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            include: { group: true, faculty: true, program: true },
          },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const { enrollments, appointments, staffFaculty, staffDepartment, position, ...person } = session.person;
  // все должности человека — для переключателя в шапке (SPEC §17)
  const roles: StaffRole[] = [
    { id: null, role: person.role, unit: staffDepartment?.name ?? staffFaculty?.name ?? null, position },
    ...appointments.map((a) => ({ id: a.id, role: a.role, unit: a.staffDepartment.name, position: null })),
  ];
  const active = session.appointmentId ? appointments.find((a) => a.id === session.appointmentId) : undefined;
  // активная дополнительная должность подменяет роль и подразделение; права определяются только ею
  const current = active
    ? { ...person, role: active.role, staffFacultyId: null, staffDepartmentId: active.staffDepartmentId, isHead: false }
    : person;
  return { ...current, roles, activeAppointmentId: active?.id ?? null, sessionId: session.id, enrollment: enrollments[0] ?? null };
});

export async function requireUser(roles?: Role[], opts: { allowPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // одноразовый пароль от деканата/кафедры — сначала смена (SPEC §14)
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/account/password");
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}

export async function requireStudent() {
  const user = await requireUser(["STUDENT"]);
  if (!user.enrollment) redirect("/login?e=noenrollment");
  return { ...user, enrollment: user.enrollment };
}

export function homeFor(role: Role) {
  switch (role) {
    case "STUDENT": return "/today";
    case "DEAN_OFFICE": return "/staff/requests";
    case "SUPERVISOR": return "/staff/students";
    case "DEPARTMENT": return "/staff/graduates";
    case "RECTOR": return "/staff/accounts";
  }
}
