"use client";

import { startTransition, useActionState, useState } from "react";
import { createAccount, createBulk, deleteDean, previewBulk, resetPassword, updateAccount, type AccState, type Cred, type EditState, type PreviewState } from "@/app/actions/accounts";
import { Button } from "@/components/ui/button";

/** Типовые должности деканата: декан → заместители → начальники курсов, руководители магистерских программ, специалисты. */
export const POSITIONS = [
  "Заместитель декана по учебной работе", "Заместитель декана по работе со студентами", "Заместитель декана по магистратуре",
  "Начальник 1 курса", "Начальник 2 курса", "Начальник 3 курса", "Начальник 4 курса",
  "Руководитель магистерской программы", "Специалист по учебной работе", "Методист", "Секретарь деканата",
];

/** Отправка без автосброса формы React 19: при ошибке введённое не пропадает. */
const keepValues = (action: (fd: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  startTransition(() => action(fd));
};

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

export function CreateForm({ kind, faculties, departments, programs, groups, managers = [] }: { kind: string; faculties: Opt[]; departments: Opt[]; programs: Opt[]; groups: Opt[]; managers?: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<AccState, FormData>(createAccount, undefined);
  const [newDep, setNewDep] = useState(false);
  return (
    <form onSubmit={keepValues(action)} className="space-y-3" key={state?.creds?.[0]?.login ?? "form"}>
      <input type="hidden" name="kind" value={kind} />
      <Field label={kind === "department" ? "ФИО сотрудника кафедры" : kind === "dean" ? "ФИО декана" : kind === "staff" ? "ФИО сотрудника" : kind === "supervisor" ? "ФИО преподавателя" : "ФИО"} hint="Фамилия Имя Отчество — логин соберётся сам">
        <input name="fio" required placeholder="Иванов Петр Владимирович" className={f} />
      </Field>
      {kind === "dean" && <Field label="Факультет"><select name="facultyId" required className={f} defaultValue="">{[<option key="" value="" disabled>Выберите…</option>, ...faculties.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)]}</select></Field>}
      {kind === "staff" && (
        <>
          <Field label="Должность">
            <input name="position" required list="positions" placeholder="Заместитель декана · Начальник 1 курса" className={f} />
            <datalist id="positions">{POSITIONS.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="Руководитель в структуре"><select name="managerId" className={f} defaultValue={managers[0]?.id}>{managers.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
        </>
      )}
      {kind === "dean" && <p className="text-xs text-muted-foreground">Кабинет, часы приёма и остальное декан заполнит сам в своей карточке.</p>}
      {kind === "staff" && (
        <>
          <Field label="За что отвечает" hint="Это увидят студенты: «1–2 курс, справки и расписание»"><input name="duties" maxLength={300} className={f} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Кабинет"><input name="staffRoom" maxLength={60} placeholder="каб. 214" className={f} /></Field>
            <Field label="Часы приёма"><input name="staffHours" maxLength={80} placeholder="пн–чт 10:00–17:00" className={f} /></Field>
          </div>
          <Field label="Рабочий телефон"><input name="workPhone" maxLength={40} placeholder="+7 (000) 000-00-00, доб. 000" className={f} /></Field>
        </>
      )}
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
          <Field label="Сколько студентов готов вести как научный руководитель"><input name="maxStudents" type="number" min={1} max={15} defaultValue={5} className={f} /></Field>
        </>
      )}
      {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Создаём…" : "Создать аккаунт"}</Button>
      {state?.creds && <CredsResult creds={state.creds} />}
    </form>
  );
}

export function BulkUpload({ kind, programs, groups }: { kind: "student" | "postgrad" | "supervisor"; programs: Opt[]; groups: Opt[] }) {
  const [preview, previewAction, previewing] = useActionState<PreviewState, FormData>(previewBulk, undefined);
  const [created, createAction, creating] = useActionState<AccState, FormData>(createBulk, undefined);
  const ok = preview?.rows?.filter((r) => !r.error) ?? [];
  const bad = preview?.rows?.filter((r) => r.error) ?? [];
  if (created?.creds) return <CredsResult creds={created.creds} />;
  return (
    <div className="space-y-3">
      <form action={previewAction} className="space-y-3">
        <input type="hidden" name="kind" value={kind} />
        {kind === "supervisor"
          ? <Field label="Сколько студентов может вести каждый" hint="Потом можно поправить в анкете конкретного преподавателя"><input name="maxStudents" type="number" min={0} max={15} defaultValue={5} className={f} /></Field>
          : <LearnerParams kind={kind} programs={programs} groups={groups} />}
        <Field label="Файл со списком (.xlsx или .csv)"><input name="file" type="file" required accept=".xlsx,.csv,.txt" className="block w-full text-sm file:mr-3 file:h-11 file:rounded-sm file:border-0 file:bg-secondary file:px-4 file:font-semibold file:text-navy" /></Field>
        {preview?.error && <p role="alert" className="text-sm text-brand-red">{preview.error}</p>}
        <Button type="submit" variant="outline" className="h-11 w-full" disabled={previewing}>{previewing ? "Читаем файл…" : "Проверить список"}</Button>
      </form>
      {preview?.rows && (
        <div className="space-y-2">
          <p className="text-sm"><b className="text-status-ok">Готовы к созданию: {ok.length}</b>{bad.length > 0 && <> · <b className="text-brand-red">с ошибками: {bad.length}</b> (будут пропущены)</>}</p>
          <div className="max-h-72 overflow-auto rounded-sm border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-2">Стр.</th><th className="p-2">ФИО</th><th className="p-2">Логин</th>{kind === "student" && <th className="p-2">Группа</th>}{kind === "supervisor" && <th className="p-2">Должность</th>}</tr></thead>
              <tbody className="divide-y">
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.error ? "bg-brand-red/5" : ""}>
                    <td className="p-2 tabular-nums text-muted-foreground">{r.line}</td>
                    <td className="p-2">{r.fio}{r.error && <span className="block text-xs text-brand-red">{r.error}</span>}</td>
                    <td className="p-2"><code>{r.login}</code></td>
                    {kind === "student" && <td className="p-2">{r.group ?? ""}</td>}
                    {kind === "supervisor" && <td className="p-2">{[r.position ?? "преподаватель", r.degree].filter(Boolean).join(", ")}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ok.length > 0 && (
            <form action={createAction}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="batch" value={preview.batch} />
              <input type="hidden" name="rows" value={JSON.stringify(ok.map((r) => ({ fio: r.fio, group: r.group, position: r.position, degree: r.degree })))} />
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

type EditPerson = {
  id: string; fio: string; facultyId?: number | null; isHead?: boolean; managerId?: string | null;
  position?: string | null; duties?: string | null; room?: string | null; hours?: string | null; phone?: string | null;
  degree?: string | null; interests?: string | null; maxStudents?: number | null;
};

/**
 * «Изменить анкету» — раскрывающаяся форма под строкой аккаунта.
 * mode: dean — ФИО и факультет (проректор); staff — сотрудник деканата; self — своя карточка; supervisor — преподаватель; fio — только ФИО.
 */
export function EditAccount({ mode, person, faculties = [], managers = [], label = "Изменить анкету" }: { mode: "dean" | "staff" | "self" | "supervisor" | "fio"; person: EditPerson; faculties?: Opt[]; managers?: { id: string; label: string }[]; label?: string }) {
  const [state, action, pending] = useActionState<EditState, FormData>(updateAccount, undefined);
  return (
    <details className="group mt-2 w-full">
      <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-sm border px-3 text-sm">{label}</summary>
      <form onSubmit={keepValues(action)} className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
        <input type="hidden" name="id" value={person.id} />
        {mode !== "self" && <Field label="ФИО" hint="Логин не меняется — человек входит по прежнему"><input name="fio" required defaultValue={person.fio} className={f} /></Field>}
        {mode === "dean" && <Field label="Факультет"><select name="facultyId" required defaultValue={person.facultyId ?? ""} className={f}>{faculties.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>}
        {mode === "staff" && !person.isHead && (
          <>
            <Field label="Должность"><input name="position" required list="positions-edit" defaultValue={person.position ?? ""} className={f} /><datalist id="positions-edit">{POSITIONS.map((p) => <option key={p} value={p} />)}</datalist></Field>
            <Field label="Руководитель в структуре"><select name="managerId" defaultValue={person.managerId ?? ""} className={f}>{person.managerId && !managers.some((m) => m.id === person.managerId) && <option value={person.managerId}>— без изменений —</option>}{managers.filter((m) => m.id !== person.id).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
          </>
        )}
        {(mode === "staff" || mode === "self") && (
          <>
            <Field label="За что отвечает" hint="Это увидят студенты в «Мой деканат»"><input name="duties" maxLength={300} defaultValue={person.duties ?? ""} className={f} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Кабинет"><input name="staffRoom" maxLength={60} defaultValue={person.room ?? ""} className={f} /></Field>
              <Field label="Часы приёма"><input name="staffHours" maxLength={80} defaultValue={person.hours ?? ""} className={f} /></Field>
            </div>
            <Field label="Рабочий телефон"><input name="workPhone" maxLength={40} defaultValue={person.phone ?? ""} className={f} /></Field>
          </>
        )}
        {mode === "supervisor" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Должность"><input name="position" required defaultValue={person.position ?? "преподаватель"} className={f} /></Field>
              <Field label="Учёная степень"><input name="degree" defaultValue={person.degree ?? ""} className={f} /></Field>
            </div>
            <Field label="Научные интересы" hint="По ним студенты ищут руководителя"><input name="interests" maxLength={300} defaultValue={person.interests ?? ""} className={f} /></Field>
            <Field label="Сколько студентов может вести"><input name="maxStudents" type="number" min={0} max={15} defaultValue={person.maxStudents ?? 5} className={f} /></Field>
          </>
        )}
        {state?.error && <p role="alert" className="text-sm text-brand-red">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm font-semibold text-status-ok">{state.ok}</p>}
        <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить"}</Button>
      </form>
    </details>
  );
}

export function DeleteDeanButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<EditState, FormData>(deleteDean, undefined);
  if (state?.ok) return <p role="status" className="text-sm font-semibold text-status-ok">{state.ok}</p>;
  return (
    <form action={action} onSubmit={(e) => { if (!confirm("Удалить анкету декана? Вход по этому логину перестанет работать. Сотрудники деканата останутся и перейдут к новому декану.")) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="h-11 rounded-sm border border-brand-red/40 px-3 text-sm text-brand-red">{pending ? "…" : "Удалить анкету"}</button>
      {state?.error && <p className="text-xs text-brand-red">{state.error}</p>}
    </form>
  );
}
