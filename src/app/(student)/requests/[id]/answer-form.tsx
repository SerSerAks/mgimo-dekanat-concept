"use client";

import { useActionState } from "react";
import { answerRequest, type StatusState } from "@/app/actions/requests";
import { Button } from "@/components/ui/button";

export function AnswerForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<StatusState, FormData>(answerRequest, undefined);
  return (
    <form action={action} className="space-y-2 rounded-lg border p-4">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="answer" className="text-sm font-medium">Ваш ответ деканату</label>
      <textarea id="answer" name="answer" rows={3} required minLength={2} maxLength={500} className="w-full rounded-sm border px-3 py-2" />
      {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Отправляем…" : "Ответить"}</Button>
    </form>
  );
}
