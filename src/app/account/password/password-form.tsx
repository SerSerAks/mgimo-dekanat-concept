"use client";

import { useActionState } from "react";
import { changeOwnPassword, type PwState } from "@/app/actions/accounts";
import { Button } from "@/components/ui/button";

const f = "h-11 w-full rounded-sm border border-input px-3";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PwState, FormData>(changeOwnPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5"><label htmlFor="current" className="text-sm font-medium">Текущий (выданный) пароль</label><input id="current" name="current" type="password" autoComplete="current-password" required className={f} /></div>
      <div className="space-y-1.5"><label htmlFor="next" className="text-sm font-medium">Новый пароль</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required className={f} /><p className="text-xs text-muted-foreground">Не короче 10 символов, без логина внутри.</p></div>
      <div className="space-y-1.5"><label htmlFor="repeat" className="text-sm font-medium">Повторите новый пароль</label><input id="repeat" name="repeat" type="password" autoComplete="new-password" minLength={10} required className={f} /></div>
      {state?.error && <p role="alert" className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить и войти"}</Button>
    </form>
  );
}
