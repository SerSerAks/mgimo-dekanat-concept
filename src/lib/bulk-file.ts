import "server-only";
import { readSheet } from "read-excel-file/node";

export type RawRow = { line: number; fio: string; group: string | null; position: string | null; degree: string | null };
const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 500;

/**
 * Разбор списка из Excel (.xlsx) или CSV: первая колонка — ФИО, либо колонки «Фамилия», «Имя», «Отчество»;
 * необязательные колонки «Группа» (студенты), «Должность» и «Степень» (преподаватели). Заголовок определяется по названиям колонок.
 */
export async function readPeopleFile(file: File): Promise<{ rows: RawRow[] } | { error: string }> {
  if (file.size === 0) return { error: "Файл пустой" };
  if (file.size > MAX_BYTES) return { error: "Файл больше 2 МБ" };
  const name = file.name.toLowerCase();
  let table: string[][];
  try {
    if (name.endsWith(".xlsx")) {
      const data = await readSheet(Buffer.from(await file.arrayBuffer()));
      table = data.map((r) => r.map((c) => (c == null ? "" : String(c).trim())));
    } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const text = (await file.text()).replace(/^﻿/, "");
      const sep = text.includes(";") ? ";" : text.includes("\t") ? "\t" : ",";
      table = text.split(/\r?\n/).map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()));
    } else return { error: "Подходят файлы .xlsx или .csv" };
  } catch {
    return { error: "Не получилось прочитать файл — сохраните его как .xlsx или .csv (UTF-8)" };
  }
  table = table.filter((r) => r.some((c) => c));
  if (!table.length) return { error: "В файле нет строк" };

  const head = table[0].map((c) => c.toLowerCase());
  const has = (re: RegExp) => head.findIndex((c) => re.test(c));
  const iFio = has(/фио|ф\.и\.о/), iLast = has(/^фамилия/), iFirst = has(/^имя/), iMid = has(/^отчество/), iGroup = has(/^групп/), iPos = has(/^должн/), iDeg = has(/степень/);
  const isHeader = iFio >= 0 || iLast >= 0 || iGroup >= 0 || iPos >= 0;
  const body = isHeader ? table.slice(1) : table;
  if (body.length > MAX_ROWS) return { error: `Не больше ${MAX_ROWS} строк за раз — разбейте файл` };

  const rows = body.map((r, i) => {
    const fio = iLast >= 0 ? [r[iLast], r[iFirst] ?? "", iMid >= 0 ? r[iMid] ?? "" : ""].join(" ").trim() : (r[iFio >= 0 ? iFio : 0] ?? "");
    return { line: i + (isHeader ? 2 : 1), fio, group: iGroup >= 0 ? (r[iGroup] || null) : null,
      position: iPos >= 0 ? (r[iPos]?.slice(0, 60) || null) : null, degree: iDeg >= 0 ? (r[iDeg]?.slice(0, 60) || null) : null };
  });
  return { rows };
}
