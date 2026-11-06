"use client";

import { useActionState } from "react";
import { addPractice, type PracticeState } from "@/app/actions/practice";
import { Button } from "@/components/ui/button";

const f = "h-11 w-full rounded-sm border border-input bg-background px-3";
const L = ({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) => <label htmlFor={htmlFor} className="text-sm font-medium">{children}</label>;

export function PracticeForm({ programs }: { programs: { id: number; label: string }[] }) {
  const [state, action, pending] = useActionState<PracticeState, FormData>(addPractice, undefined);
  return (
    <form action={action} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
      <div className="space-y-1.5"><L htmlFor="level">Уровень</L><select id="level" name="level" className={f}><option value="BACHELOR">Бакалавриат</option><option value="MASTER">Магистратура</option><option value="POSTGRAD">Аспирантура</option></select></div>
      <div className="space-y-1.5"><L htmlFor="course">Курс</L><input id="course" name="course" type="number" min={1} max={6} defaultValue={3} className={f} /></div>
      <div className="space-y-1.5 sm:col-span-2"><L htmlFor="programId">Направление</L>
        <select id="programId" name="programId" className={f} defaultValue=""><option value="">Все направления факультета</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
      <div className="space-y-1.5"><L htmlFor="kind">Вид практики</L><select id="kind" name="kind" className={f}>{["Учебная", "Производственная", "Преддипломная", "Педагогическая"].map((k) => <option key={k}>{k}</option>)}</select></div>
      <div className="space-y-1.5"><L htmlFor="title">Название</L><input id="title" name="title" required minLength={3} maxLength={120} className={f} placeholder="Производственная практика" /></div>
      <div className="space-y-1.5"><L htmlFor="startDate">Начало</L><input id="startDate" name="startDate" type="date" required className={f} /></div>
      <div className="space-y-1.5"><L htmlFor="endDate">Окончание</L><input id="endDate" name="endDate" type="date" required className={f} /></div>
      <div className="space-y-1.5"><L htmlFor="docsDeadline">Согласовать место до</L><input id="docsDeadline" name="docsDeadline" type="date" className={f} /></div>
      <div className="space-y-1.5"><L htmlFor="note">Примечание</L><input id="note" name="note" maxLength={200} className={f} /></div>
      {state?.error && <p role="alert" className="text-sm text-brand-red sm:col-span-2">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-status-ok sm:col-span-2">Период добавлен.</p>}
      <Button type="submit" className="h-11 sm:col-span-2" disabled={pending}>{pending ? "Сохраняем…" : "Добавить"}</Button>
    </form>
  );
}
