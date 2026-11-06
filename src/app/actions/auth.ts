"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, homeFor } from "@/lib/auth";
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

  const person = await db.person.findUnique({ where: { login: loginName }, select: { id: true, role: true, passwordHash: true } });
  const ok = person
    ? await verifyPassword(person.passwordHash, parsed.data.password)
    : (await verifyPassword(await dummyHash(), parsed.data.password), false);

  await recordLoginAttempt(loginName, ip, ok);
  // Одинаковое сообщение для «нет логина» и «неверный пароль» — не подсказываем, какие логины существуют.
  if (!ok || !person) return { error: "Неверный логин или пароль", login: parsed.data.login };

  await createSession(person.id);
  redirect(homeFor(person.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
