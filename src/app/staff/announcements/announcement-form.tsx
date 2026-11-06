"use client";

import { useActionState, useState } from "react";
import { publishAnnouncement, type AnnState } from "@/app/actions/announcements";
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
