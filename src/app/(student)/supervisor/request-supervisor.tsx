"use client";

import { useActionState, useState } from "react";
import { sendSupervisorRequest, type SupState } from "@/app/actions/supervision";
import { Button } from "@/components/ui/button";

export function RequestSupervisor({ campaignId, supervisorId, name }: { campaignId: number; supervisorId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SupState, FormData>(sendSupervisorRequest, undefined);
  if (state?.ok) return <p role="status" className="mt-3 text-sm font-semibold text-status-ok">Заявка отправлена. Ответ придёт уведомлением.</p>;
  if (!open) return <Button type="button" className="mt-3 h-11" onClick={() => setOpen(true)}>Отправить заявку</Button>;
  return (
    <form action={action} className="mt-3 space-y-3 border-t pt-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="supervisorId" value={supervisorId} />
      <div className="space-y-1.5">
        <label htmlFor={`t-${supervisorId}`} className="text-sm font-medium">Предлагаемая тема</label>
        <input id={`t-${supervisorId}`} name="topic" required minLength={3} maxLength={200} placeholder="Или «Хочу обсудить тему»" className="h-11 w-full rounded-sm border px-3" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`m-${supervisorId}`} className="text-sm font-medium">Сообщение для {name}</label>
        <textarea id={`m-${supervisorId}`} name="message" required minLength={10} maxLength={1000} rows={4} placeholder="Почему именно эта тема, что уже сделано, договорились ли лично" className="w-full rounded-sm border px-3 py-2" />
      </div>
      {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>Отмена</Button>
        <Button type="submit" className="h-11" disabled={pending}>{pending ? "Отправляем…" : "Отправить"}</Button>
      </div>
    </form>
  );
}
