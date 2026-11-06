"use client";

import { Fragment, useActionState, useRef, useState } from "react";
import { createRequest, type CreateState } from "@/app/actions/requests";
import type { Field } from "@/lib/requests";
import { Button } from "@/components/ui/button";

const input = "h-11 w-full rounded-sm border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring";

export function RequestForm({ type, fields, profile, delivery }: { type: string; fields: Field[]; profile: [string, string][]; delivery: boolean }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createRequest, undefined);
  const [review, setReview] = useState<[string, string][] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function toReview() {
    const f = formRef.current!;
    if (!f.reportValidity()) return;
    const data = new FormData(f);
    const rows: [string, string][] = fields.map((x) => [x.label, String(data.get(x.name) ?? "")]).filter(([, v]) => v) as [string, string][];
    if (delivery) rows.push(["Как получить", String(data.get("delivery"))]);
    setReview(rows);
  }

  return (
    <form ref={formRef} action={action} className="space-y-5" noValidate={false}>
      <input type="hidden" name="type" value={type} />
      <section className="rounded-lg border bg-muted/40 p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Из профиля</h2>
        <dl className="grid gap-1 text-sm sm:grid-cols-[140px_1fr]">
          {profile.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></Fragment>))}
        </dl>
      </section>

      {/* поля остаются в DOM на шаге проверки — чтобы значения ушли на сервер */}
      <div className={review ? "hidden" : "space-y-4"}>
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <label htmlFor={f.name} className="text-sm font-medium">{f.label}{f.required && <span className="text-brand-red"> *</span>}</label>
            {f.kind === "select" ? (
              <select id={f.name} name={f.name} required={f.required} className={input} defaultValue="">
                <option value="" disabled>Выберите…</option>
                {f.options?.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : f.kind === "textarea" ? (
              <textarea id={f.name} name={f.name} required={f.required} maxLength={f.max} rows={4} className={`${input} h-auto py-2`} />
            ) : (
              <input id={f.name} name={f.name} required={f.required} type={f.kind === "number" ? "number" : "text"}
                min={f.min} max={f.kind === "number" ? f.max : undefined} maxLength={f.kind === "text" ? f.max : undefined}
                defaultValue={f.kind === "number" ? 1 : undefined} inputMode={f.kind === "number" ? "numeric" : undefined} className={input} />
            )}
            {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            {state?.errors?.[f.name] && <p className="text-sm text-brand-red">{state.errors[f.name]}</p>}
          </div>
        ))}
        {delivery && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Как получить</legend>
            {["в деканате", "электронно"].map((v, i) => (
              <label key={v} className="flex min-h-11 items-center gap-3 rounded-sm border px-3">
                <input type="radio" name="delivery" value={v} defaultChecked={i === 0} className="size-4 accent-[var(--mgimo-navy)]" />
                {v === "в деканате" ? "Забрать в деканате" : "Электронно (PDF в кабинете)"}
              </label>
            ))}
          </fieldset>
        )}
        <Button type="button" onClick={toReview} className="h-11 w-full">Проверить</Button>
      </div>

      {review && (
        <section className="space-y-4">
          <h2 className="font-semibold text-navy">Проверьте заявку</h2>
          <dl className="divide-y rounded-lg border">
            {review.map(([k, v]) => (
              <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-sm text-muted-foreground">{k}</dt><dd className="font-medium break-words">{v}</dd></div>
            ))}
          </dl>
          {state?.message && <p role="alert" className="text-sm text-brand-red">{state.message}</p>}
          {state?.errors && <p role="alert" className="text-sm text-brand-red">Есть ошибки в полях — нажмите «Изменить».</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" className="h-11" onClick={() => setReview(null)}>Изменить</Button>
            <Button type="submit" className="h-11" disabled={pending}>{pending ? "Отправляем…" : "Отправить"}</Button>
          </div>
        </section>
      )}
    </form>
  );
}
