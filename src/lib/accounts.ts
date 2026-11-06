/**
 * Создание аккаунтов (SPEC §14): логин из ФИО, одноразовый пароль, разбор ФИО.
 * Без "server-only" — используется и в скриптах seed.
 */
import { randomInt } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Транслитерация (близко к правилам загранпаспорта): «Щукина» → «Shchukina». Латиница и дефис сохраняются. */
export function translit(s: string) {
  return [...s.toLowerCase()].map((ch) => MAP[ch] ?? (/[a-z-]/.test(ch) ? ch : "")).join("");
}
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export type Fio = { lastName: string; firstName: string; middleName: string | null };

/** «Иванов Петр Владимирович» → { lastName, firstName, middleName }. Лишние пробелы и регистр нормализуются. */
export function parseFio(raw: string): Fio | null {
  const parts = raw.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return null;
  if (!parts.every((p) => /^[А-Яа-яЁёA-Za-z-]{1,40}$/.test(p))) return null;
  const norm = (p: string) => p.split("-").map((x) => cap(x.toLowerCase())).join("-");
  const [lastName, firstName, ...rest] = parts.map(norm);
  return { lastName, firstName, middleName: rest.length ? rest.join(" ") : null };
}

/** Базовый логин: Ivanov_P_V (без отчества — Ivanov_P). Инициал — первая буква полностью: Юрий → Yu. */
export function baseLogin(f: Fio) {
  const initial = (x: string) => cap(translit(x[0]) || translit(x).slice(0, 1));
  const last = f.lastName.split("-").map((x) => cap(translit(x))).join("-");
  return [last, initial(f.firstName), ...(f.middleName ? [initial(f.middleName)] : [])].join("_");
}

/** Уникальный логин: Ivanov_P_V, затем Ivanov_P_V2, Ivanov_P_V3… Сравнение без учёта регистра; `reserved` — логины, уже выданные в этой партии. */
export async function uniqueLogin(db: PrismaClient, base: string, reserved = new Set<string>()) {
  const existing = await db.person.findMany({ where: { login: { startsWith: base, mode: "insensitive" } }, select: { login: true } });
  const taken = new Set([...existing.map((p) => p.login.toLowerCase()), ...[...reserved].map((l) => l.toLowerCase())]);
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`.toLowerCase())) return `${base}${n}`;
}

/** Одноразовый пароль: 12 символов без похожих (0/O, 1/l/I). */
export function generatePassword(len = 12) {
  const abc = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => abc[randomInt(abc.length)]).join("");
}

/** Номер студенческого билета (ДОПУЩЕНИЕ: формат условный). */
export function studentCardNo(startYear: number, facultyCode: string) {
  return `${String(startYear).slice(2)}-${facultyCode}-${String(randomInt(10000)).padStart(4, "0")}`;
}
