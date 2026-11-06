"use client";

import { useActionState } from "react";
import { openIntake, type SupState } from "@/app/actions/supervision";
import { Button } from "@/components/ui/button";

export function IntakeForm({ campaignId, slots, open }: { campaignId: number; slots: number; open: boolean }) {
  const [state, action, pending] = useActionState<SupState, FormData>(openIntake, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <label className="space-y-1 text-sm"><span className="block font-medium">Мест</span>
        <input type="number" name="slots" min={1} max={15} defaultValue={slots} className="h-11 w-20 rounded-sm border px-3" /></label>
      <Button type="submit" className="h-11" disabled={pending}>{open ? "Изменить" : "Открыть приём"}</Button>
      {state?.error && <p role="alert" className="w-full text-sm text-brand-red">{state.error}</p>}
      {state?.info && <p role="status" className="w-full text-sm text-status-ok">{state.info}</p>}
    </form>
  );
}
