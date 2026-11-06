"use client";

import { useActionState } from "react";
import { submitCheck, type UploadState } from "@/app/actions/antiplagiat";
import { Button } from "@/components/ui/button";

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(submitCheck, undefined);
  return (
    <form action={action} className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">Название работы</label>
        <input id="title" name="title" required minLength={3} maxLength={120} placeholder="Например: Курсовая работа по истории МО" className="h-11 w-full rounded-sm border border-input px-3" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="file" className="text-sm font-medium">Файл (PDF, DOCX — до 10 МБ)</label>
        <input id="file" name="file" type="file" required accept=".pdf,.doc,.docx,.odt,.rtf" className="block w-full text-sm file:mr-3 file:h-11 file:rounded-sm file:border-0 file:bg-secondary file:px-4 file:font-semibold file:text-navy" />
      </div>
      {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Загружаем…" : "Отправить на проверку"}</Button>
    </form>
  );
}
