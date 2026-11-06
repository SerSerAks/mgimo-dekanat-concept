"use client";

import { useActionState, useState } from "react";
import { loadPlan, updateCampaignDates, type SupState } from "@/app/actions/supervision";
import { Button } from "@/components/ui/button";

export function LoadPlanButton({ loaded }: { loaded: boolean }) {
  const [state, action, pending] = useActionState<SupState, FormData>(loadPlan, undefined);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" className="h-11" variant={loaded ? "outline" : "default"} disabled={pending}>
        {pending ? "Загружаем…" : loaded ? "Догрузить недостающие работы из плана" : "Загрузить учебный план 2026/27"}
      </Button>
      {state?.info && <p role="status" className="text-sm text-status-ok">{state.info}</p>}
      {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
    </form>
  );
}

export function CampaignDates({ id, openBy, chooseBy }: { id: number; openBy: string; chooseBy: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<SupState, FormData>(updateCampaignDates, undefined);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm font-semibold text-brand-blue">Изменить сроки</button>;
  return (
    <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="id" value={id} />
      <label className="space-y-1 text-sm"><span className="font-medium">Открыть приём до</span><input type="date" name="openBy" defaultValue={openBy} required className="h-11 w-full rounded-sm border px-3" /></label>
      <label className="space-y-1 text-sm"><span className="font-medium">Выбрать до</span><input type="date" name="chooseBy" defaultValue={chooseBy} required className="h-11 w-full rounded-sm border px-3" /></label>
      <Button type="submit" className="h-11" disabled={pending}>Сохранить</Button>
      {state?.error && <p role="alert" className="text-sm text-brand-red sm:col-span-3">{state.error}</p>}
      {state?.info && <p role="status" className="text-sm text-status-ok sm:col-span-3">{state.info}</p>}
    </form>
  );
}
