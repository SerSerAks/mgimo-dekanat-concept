"use client";

import { useActionState, useState } from "react";
import { changeRequestStatus, type StatusState } from "@/app/actions/requests";
import type { Transition } from "@/lib/request-flow";
import { Button } from "@/components/ui/button";

export function StatusActions({ id, transitions, delivery }: { id: string; transitions: Transition[]; delivery: string }) {
  const [state, action, pending] = useActionState<StatusState, FormData>(changeRequestStatus, undefined);
  const [picked, setPicked] = useState<Transition | null>(null);
  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Действие</h2>
      {!picked ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {transitions.map((t) => (
            <Button key={t.to} type="button" variant={t.tone === "primary" ? "default" : t.tone === "danger" ? "destructive" : "outline"} className="h-11"
              onClick={() => setPicked(t)}>{t.label}</Button>
          ))}
        </div>
      ) : (
        <form action={action} className="space-y-3" onSubmit={() => undefined}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="to" value={picked.to} />
          {picked.needs === "pickup" && delivery === "в деканате" && (
            <div className="space-y-1.5">
              <label htmlFor="pickup" className="text-sm font-medium">Где забрать</label>
              <input id="pickup" name="pickup" required minLength={3} maxLength={120} defaultValue="каб. 214, пн–пт 10:00–17:00" className="h-11 w-full rounded-sm border px-3" />
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="comment" className="text-sm font-medium">{picked.needs === "comment" ? "Комментарий для студента *" : "Комментарий (необязательно)"}</label>
            <textarea id="comment" name="comment" rows={3} maxLength={500} required={picked.needs === "comment"} className="w-full rounded-sm border px-3 py-2"
              placeholder={picked.to === "NEEDS_INFO" ? "Что нужно уточнить?" : picked.to === "REJECTED" ? "Причина отказа" : ""} />
          </div>
          {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setPicked(null)}>Назад</Button>
            <Button type="submit" className="h-11" disabled={pending}>{pending ? "Сохраняем…" : `${picked.label} — подтвердить`}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Студент получит уведомление.</p>
        </form>
      )}
    </section>
  );
}
