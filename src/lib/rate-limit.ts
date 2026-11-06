import "server-only";
import { db } from "./db";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_LOGIN = 5;
const MAX_PER_IP = 20;

// Защита от перебора: не больше 5 неудач на логин и 20 на IP за 5 минут.
export async function isLoginBlocked(login: string, ip: string) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byLogin, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { login, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ]);
  return byLogin >= MAX_PER_LOGIN || byIp >= MAX_PER_IP;
}

export function recordLoginAttempt(login: string, ip: string, success: boolean) {
  return db.loginAttempt.create({ data: { login, ip, success } });
}
