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
  await db.session.create({ data: { id: sha256(token), personId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
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
          avatarColor: true, staffFacultyId: true, staffDepartmentId: true, mustChangePassword: true,
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
  const { enrollments, ...person } = session.person;
  return { ...person, enrollment: enrollments[0] ?? null };
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
