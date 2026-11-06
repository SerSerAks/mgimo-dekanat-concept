"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, homeFor, switchRole } from "@/lib/auth";
import { dummyHash, verifyPassword } from "@/lib/password";
import { isLoginBlocked, recordLoginAttempt } from "@/lib/rate-limit";

const LoginSchema = z.object({
  login: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export type LoginState = { error?: string; login?: string } | undefined;

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({ login: formData.get("login"), password: formData.get("password") });
  if (!parsed.success) return { error: "Введите логин и пароль" };
  const loginName = parsed.data.login.toLowerCase();

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";

  if (await isLoginBlocked(loginName, ip)) {
    return { error: "Слишком много попыток входа. Подождите 5 минут.", login: parsed.data.login };
  }

  // логин без учёта регистра: Ivanov_P_V = ivanov_p_v (уникальность без учёта регистра обеспечивает lib/accounts)
  const person = await db.person.findFirst({ where: { login: { equals: loginName, mode: "insensitive" } }, select: { id: true, role: true, passwordHash: true, mustChangePassword: true } });
  const ok = person
    ? await verifyPassword(person.passwordHash, parsed.data.password)
    : (await verifyPassword(await dummyHash(), parsed.data.password), false);

  await recordLoginAttempt(loginName, ip, ok);
  // Одинаковое сообщение для «нет логина» и «неверный пароль» — не подсказываем, какие логины существуют.
  if (!ok || !person) return { error: "Неверный логин или пароль", login: parsed.data.login };

  const extraRole = await createSession(person.id);
  redirect(person.mustChangePassword ? "/account/password" : homeFor(extraRole ?? person.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/** Переключатель должностей в шапке (SPEC §17): та же учётка, другая роль и подразделение. */
export async function switchRoleAction(form: FormData) {
  const raw = String(form.get("appointmentId") ?? "");
  const r = await switchRole(raw === "primary" ? null : raw);
  if (!r) redirect("/");
  redirect(homeFor(r.role));
}
