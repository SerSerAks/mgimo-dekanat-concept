"use client";

import { useActionState, useState } from "react";
import { createAccount, createBulk, previewBulk, resetPassword, type AccState, type Cred, type PreviewState } from "@/app/actions/accounts";
import { Button } from "@/components/ui/button";

type Opt = { id: number; label: string; level?: string; course?: number };
const f = "h-11 w-full min-w-0 max-w-full rounded-sm border border-input bg-background px-3";
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block min-w-0 space-y-1.5 text-sm"><span className="font-medium">{label}</span>{children}{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</label>
);

/** Логины и одноразовые пароли: показываются один раз, скачиваются файлом для выдачи (CSV, «;», UTF-8 с BOM — открывается в Excel). */
export function CredsResult({ creds }: { creds: Cred[] }) {
  function download() {
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const body = [["ФИО", "Логин", "Пароль", "Примечание"], ...creds.map((c) => [c.fio, c.login, c.password, c.note])].map((r) => r.map(esc).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `logins-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(url);
  }
  return (
    <div role="status" className="mt-3 space-y-2 rounded-lg border border-status-ok/40 bg-status-ok/5 p-3">
      <p className="text-sm font-semibold text-status-ok">Готово: {creds.length}. Пароли показываются один раз — скачайте файл для выдачи.</p>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-1">ФИО</th><th className="p-1">Логин</th><th className="p-1">Пароль</th></tr></thead>
          <tbody>{creds.map((c) => <tr key={c.login}><td className="p-1">{c.fio}</td><td className="p-1"><code>{c.login}</code></td><td className="p-1"><code>{c.password}</code></td></tr>)}</tbody>
        </table>
      </div>
      <Button type="button" onClick={download} className="h-11">Скачать логины и пароли (Excel, CSV)</Button>
    </div>
  );
}

function LearnerParams({ kind, programs, groups }: { kind: "student" | "postgrad"; programs: Opt[]; groups: Opt[] }) {
  const [level, setLevel] = useState("BACHELOR");
  const [course, setCourse] = useState(1);
  if (kind === "postgrad") return (
    <>
      <Field label="Год обучения"><input name="course" type="number" min={1} max={4} defaultValue={1} className={f} /></Field>
      <Field label="Научная специальность"><select name="programId" className={f} defaultValue=""><option value="">— не указана —</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
    </>
  );
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Уровень"><select name="level" value={level} onChange={(e) => setLevel(e.target.value)} className={f}><option value="BACHELOR">Бакалавриат</option><option value="MASTER">Магистратура</option></select></Field>
        <Field label="Курс"><input name="course" type="number" min={1} max={level === "MASTER" ? 2 : 6} value={course} onChange={(e) => setCourse(Number(e.target.value))} className={f} /></Field>
      </div>
      <Field label="Направление"><select name="programId" className={f} defaultValue=""><option value="">— не указано —</option>{programs.filter((p) => p.level === level).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
      <Field label="Группа" hint="Если в файле есть колонка «Группа», она важнее"><select name="groupId" className={f} defaultValue=""><option value="">— без группы —</option>{groups.filter((g) => g.level === level).map((g) => <option key={g.id} value={g.id}>{g.label}{g.course !== course ? ` (${g.course} курс)` : ""}</option>)}</select></Field>
    </>
  );
}

export function CreateForm({ kind, faculties, departments, programs, groups }: { kind: string; faculties: Opt[]; departments: Opt[]; programs: Opt[]; groups: Opt[] }) {
  const [state, action, pending] = useActionState<AccState, FormData>(createAccount, undefined);
  const [newDep, setNewDep] = useState(false);
  return (
    <form action={action} className="space-y-3" key={state?.creds?.[0]?.login ?? "form"}>
      <input type="hidden" name="kind" value={kind} />
      <Field label={kind === "department" ? "ФИО сотрудника кафедры" : kind === "dean" ? "ФИО сотрудника деканата" : "ФИО"} hint="Фамилия Имя Отчество — логин соберётся сам">
        <input name="fio" required placeholder="Иванов Петр Владимирович" className={f} />
      </Field>
      {kind === "dean" && <Field label="Факультет"><select name="facultyId" required className={f} defaultValue="">{[<option key="" value="" disabled>Выберите…</option>, ...faculties.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)]}</select></Field>}
      {kind === "department" && (newDep
        ? <Field label="Название новой кафедры"><input name="departmentName" minLength={5} maxLength={160} required className={f} /></Field>
        : <Field label="Кафедра"><select name="departmentId" required className={f} defaultValue="">{[<option key="" value="" disabled>Выберите…</option>, ...departments.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)]}</select></Field>)}
      {kind === "department" && <button type="button" onClick={() => setNewDep(!newDep)} className="text-sm font-semibold text-brand-blue">{newDep ? "Выбрать из списка" : "+ Кафедры нет в списке"}</button>}
      {(kind === "student" || kind === "postgrad") && <LearnerParams kind={kind} programs={programs} groups={groups} />}
      {kind === "supervisor" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Должность"><input name="position" required defaultValue="доцент" className={f} /></Field>
            <Field label="Учёная степень"><input name="degree" placeholder="канд. полит. наук" className={f} /></Field>
          </div>
          <Field label="Научные интересы" hint="По ним студенты ищут руководителя"><input name="interests" required minLength={5} maxLength={300} className={f} /></Field>
          <Field label="Сколько студентов готов вести"><input name="maxStudents" type="number" min={1} max={15} defaultValue={5} className={f} /></Field>
        </>
      )}
      {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Создаём…" : "Создать аккаунт"}</Button>
      {state?.creds && <CredsResult creds={state.creds} />}
    </form>
  );
}

export function BulkUpload({ kind, programs, groups }: { kind: "student" | "postgrad"; programs: Opt[]; groups: Opt[] }) {
  const [preview, previewAction, previewing] = useActionState<PreviewState, FormData>(previewBulk, undefined);
  const [created, createAction, creating] = useActionState<AccState, FormData>(createBulk, undefined);
  const ok = preview?.rows?.filter((r) => !r.error) ?? [];
  const bad = preview?.rows?.filter((r) => r.error) ?? [];
  if (created?.creds) return <CredsResult creds={created.creds} />;
  return (
    <div className="space-y-3">
      <form action={previewAction} className="space-y-3">
        <LearnerParams kind={kind} programs={programs} groups={groups} />
        <Field label="Файл со списком (.xlsx или .csv)"><input name="file" type="file" required accept=".xlsx,.csv,.txt" className="block w-full text-sm file:mr-3 file:h-11 file:rounded-sm file:border-0 file:bg-secondary file:px-4 file:font-semibold file:text-navy" /></Field>
        {preview?.error && <p role="alert" className="text-sm text-brand-red">{preview.error}</p>}
        <Button type="submit" variant="outline" className="h-11 w-full" disabled={previewing}>{previewing ? "Читаем файл…" : "Проверить список"}</Button>
      </form>
      {preview?.rows && (
        <div className="space-y-2">
          <p className="text-sm"><b className="text-status-ok">Готовы к созданию: {ok.length}</b>{bad.length > 0 && <> · <b className="text-brand-red">с ошибками: {bad.length}</b> (будут пропущены)</>}</p>
          <div className="max-h-72 overflow-auto rounded-sm border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-2">Стр.</th><th className="p-2">ФИО</th><th className="p-2">Логин</th>{kind === "student" && <th className="p-2">Группа</th>}</tr></thead>
              <tbody className="divide-y">
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.error ? "bg-brand-red/5" : ""}>
                    <td className="p-2 tabular-nums text-muted-foreground">{r.line}</td>
                    <td className="p-2">{r.fio}{r.error && <span className="block text-xs text-brand-red">{r.error}</span>}</td>
                    <td className="p-2"><code>{r.login}</code></td>
                    {kind === "student" && <td className="p-2">{r.group ?? ""}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ok.length > 0 && (
            <form action={createAction}>
              <input type="hidden" name="batch" value={preview.batch} />
              <input type="hidden" name="rows" value={JSON.stringify(ok.map((r) => ({ fio: r.fio, group: r.group })))} />
              {created?.error && <p role="alert" className="mb-2 text-sm text-brand-red">{created.error}</p>}
              <Button type="submit" className="h-11 w-full" disabled={creating}>{creating ? "Создаём…" : `Создать ${ok.length} аккаунтов`}</Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function ResetButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<AccState, FormData>(resetPassword, undefined);
  if (state?.creds) return <div className="w-full"><CredsResult creds={state.creds} /></div>;
  return (
    <form action={action} onSubmit={(e) => { if (!confirm("Выдать новый одноразовый пароль? Старый перестанет работать.")) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="h-11 rounded-sm border px-3 text-sm">{pending ? "…" : "Сбросить пароль"}</button>
      {state?.error && <p className="text-xs text-brand-red">{state.error}</p>}
    </form>
  );
}
