"use client";

import { useActionState, useState } from "react";
import { createNirCampaign, loadPlan, updateCampaignDates, type SupState } from "@/app/actions/supervision";
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

type Prog = { id: number; label: string; level: string };
const fld = "h-11 w-full min-w-0 rounded-sm border border-input bg-background px-3";

/** Форма кафедры: загрузить НИР для уровня, курса и (необязательно) направления. */
export function NirForm({ programs }: { programs: Prog[] }) {
  const [state, action, pending] = useActionState<SupState, FormData>(createNirCampaign, undefined);
  const [level, setLevel] = useState("MASTER");
  return (
    <form action={action} className="space-y-3" key={state?.info ?? "nir"}>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm"><span className="font-medium">Уровень</span>
          <select name="level" value={level} onChange={(e) => setLevel(e.target.value)} className={fld}>
            <option value="BACHELOR">Бакалавриат</option><option value="MASTER">Магистратура</option><option value="POSTGRAD">Аспирантура</option>
          </select>
        </label>
        <label className="space-y-1 text-sm"><span className="font-medium">Курс</span><input name="course" type="number" min={1} max={level === "MASTER" ? 2 : 4} defaultValue={1} required className={fld} /></label>
      </div>
      <label className="block space-y-1 text-sm"><span className="font-medium">Направление</span>
        <select name="programId" defaultValue="" className={fld}><option value="">Все направления уровня</option>{programs.filter((p) => p.level === level).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm"><span className="font-medium">Открыть приём до</span><input type="date" name="openBy" required className={fld} /></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Студентам выбрать до</span><input type="date" name="chooseBy" required className={fld} /></label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
      {state?.info && <p role="status" className="text-sm font-semibold text-status-ok">{state.info}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Загружаем…" : "Загрузить НИР"}</Button>
    </form>
  );
}
