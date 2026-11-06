"use client";

import { useActionState, useRef } from "react";
import { decideSupervisorRequest, type SupState } from "@/app/actions/supervision";
import { Button } from "@/components/ui/button";

export function DecideForm({ id, canAccept }: { id: string; canAccept: boolean }) {
  const [state, action, pending] = useActionState<SupState, FormData>(decideSupervisorRequest, undefined);
  // кнопка shadcn не передаёт name/value в FormData — решение кладём в скрытое поле в момент нажатия
  const decision = useRef<HTMLInputElement>(null);
  const pick = (v: string) => () => { if (decision.current) decision.current.value = v; };
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <input ref={decision} type="hidden" name="decision" defaultValue="" />
      <label htmlFor={`r-${id}`} className="text-sm font-medium">Ответ студенту (при отказе обязателен)</label>
      <textarea id={`r-${id}`} name="reply" rows={2} maxLength={500} className="w-full rounded-sm border px-3 py-2" />
      {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="submit" onClick={pick("decline")} variant="outline" className="h-11" disabled={pending}>Отказать</Button>
        <Button type="submit" onClick={pick("accept")} className="h-11" disabled={pending || !canAccept}>Принять</Button>
      </div>
    </form>
  );
}
