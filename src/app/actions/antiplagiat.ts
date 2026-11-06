"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/auth";

export type UploadState = { error?: string } | undefined;
const MAX = 10 * 1024 * 1024;
const OK_EXT = /\.(pdf|docx?|odt|rtf)$/i;

// ДОПУЩЕНИЕ: интеграции с «Антиплагиатом» нет. Содержимое файла не сохраняется — только имя и размер,
// результат проверки имитируется (см. lib/antiplagiat.ts). Так в прототип не попадают реальные тексты работ.
export async function submitCheck(_: UploadState, form: FormData): Promise<UploadState> {
  const user = await requireStudent();
  const title = z.string().trim().min(3).max(120).safeParse(form.get("title"));
  if (!title.success) return { error: "Укажите название работы (от 3 символов)" };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Прикрепите файл работы" };
  if (!OK_EXT.test(file.name)) return { error: "Подходят файлы PDF, DOC, DOCX, ODT, RTF" };
  if (file.size > MAX) return { error: "Файл больше 10 МБ" };
  await db.antiplagiatCheck.create({ data: { enrollmentId: user.enrollment.id, workTitle: title.data, fileName: file.name.slice(0, 120), fileSize: file.size } });
  revalidatePath("/antiplagiat");
  redirect("/antiplagiat?sent=1");
}
