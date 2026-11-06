"use client";

import { startTransition, useActionState, useState } from "react";
import { publishAnnouncement, updateAnnouncement, type AnnState, type EditAnnState } from "@/app/actions/announcements";
import { Button } from "@/components/ui/button";

const f = "h-11 w-full rounded-sm border border-input bg-background px-3";

export function AnnouncementForm({ groups, canNarrow }: { groups: { id: number; name: string }[]; canNarrow: boolean }) {
  const [state, action, pending] = useActionState<AnnState, FormData>(publishAnnouncement, undefined);
  const [aud, setAud] = useState("all");
  return (
    <form action={action} className="space-y-3 rounded-lg border p-4" key={state?.sent ? `sent-${Date.now()}` : "form"}>
      <div className="space-y-1.5"><label htmlFor="title" className="text-sm font-medium">Заголовок</label><input id="title" name="title" required minLength={3} maxLength={120} className={f} /></div>
      <div className="space-y-1.5"><label htmlFor="body" className="text-sm font-medium">Текст</label><textarea id="body" name="body" required minLength={3} maxLength={2000} rows={4} className="w-full rounded-sm border px-3 py-2" /></div>
      {canNarrow && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><label htmlFor="audience" className="text-sm font-medium">Кому</label>
            <select id="audience" name="audience" value={aud} onChange={(e) => setAud(e.target.value)} className={f}>
              <option value="all">Всему факультету</option><option value="course">Курсу</option><option value="group">Группе</option>
            </select></div>
          {aud === "course" && <div className="space-y-1.5"><label htmlFor="course" className="text-sm font-medium">Курс</label><input id="course" name="course" type="number" min={1} max={6} defaultValue={1} className={f} /></div>}
          {aud === "group" && <div className="space-y-1.5"><label htmlFor="groupId" className="text-sm font-medium">Группа</label>
            <select id="groupId" name="groupId" className={f}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>}
        </div>
      )}
      {!canNarrow && <input type="hidden" name="audience" value="all" />}
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="important" className="size-4" /> Важное — выделить красным</label>
      {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
      {state?.sent && <p role="status" className="text-sm text-status-ok">Опубликовано. Уведомления получили: {state.sent}.</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Публикуем…" : "Опубликовать"}</Button>
    </form>
  );
}

/** «Исправить» под опубликованным объявлением: заголовок, текст, отметка «важное». Кому — не меняется. */
export function EditAnnouncement({ a }: { a: { id: string; title: string; body: string; important: boolean } }) {
  const [state, action, pending] = useActionState<EditAnnState, FormData>(updateAnnouncement, undefined);
  const [open, setOpen] = useState(false);
  if (!open) return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(true)} className="h-11 rounded-sm border px-3 text-sm">Исправить</button>
      {state?.ok && <p role="status" className="mt-1 text-sm text-status-ok">{state.ok}</p>}
    </div>
  );
  return (
    <form className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      startTransition(async () => { action(fd); });
    }}>
      <input type="hidden" name="id" value={a.id} />
      <div className="space-y-1.5"><label htmlFor={`t-${a.id}`} className="text-sm font-medium">Заголовок</label><input id={`t-${a.id}`} name="title" required minLength={3} maxLength={120} defaultValue={a.title} className={f} /></div>
      <div className="space-y-1.5"><label htmlFor={`b-${a.id}`} className="text-sm font-medium">Текст</label><textarea id={`b-${a.id}`} name="body" required minLength={3} maxLength={2000} rows={4} defaultValue={a.body} className="w-full rounded-sm border px-3 py-2" /></div>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="important" defaultChecked={a.important} className="size-4" /> Важное — выделить красным</label>
      <p className="text-xs text-muted-foreground">Получатели те же. У них уведомление обновится и снова станет непрочитанным с пометкой «исправлено».</p>
      {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-status-ok">{state.ok}</p>}
      <div className="flex gap-2">
        <Button type="submit" className="h-11 flex-1" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить исправление"}</Button>
        <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-sm border px-3 text-sm">Закрыть</button>
      </div>
    </form>
  );
}
