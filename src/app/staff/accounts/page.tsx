import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountScope, appointmentScope, creatableKinds, staffListScope } from "@/lib/access";
import { CreateForm, BulkUpload, ResetButton, EditAccount, DeleteAccountButton, AppointExisting, RemoveAppointment, PositionsEditor } from "./account-forms";
import { facultyPositions } from "@/lib/positions";
import { deanTree } from "@/lib/dean-tree";
import { DeanTreeView } from "@/components/dean-tree-view";

const KIND = { dean: "Деканы", staff: "Сотрудники деканата", department: "Кафедры", student: "Студенты", postgrad: "Аспиранты", supervisor: "Преподаватели" } as const;
type Kind = keyof typeof KIND;
const LEVEL = { BACHELOR: "бакалавр", MASTER: "магистрант", POSTGRAD: "аспирант" } as const;

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ k?: string; q?: string }> }) {
  const user = await requireUser(["RECTOR", "DEAN_OFFICE", "DEPARTMENT"]);
  const kinds = creatableKinds(user) as readonly Kind[];
  const sp = await searchParams;
  const kind: Kind = kinds.find((k) => k === sp.k) ?? kinds[0];
  const q = (sp.q ?? "").trim().slice(0, 60);

  const byKind: Record<Kind, Prisma.PersonWhereInput> = {
    dean: { role: "DEAN_OFFICE" },
    staff: { role: "DEAN_OFFICE" },
    // совместители (SPEC §17): дополнительная должность на участке пользователя
    department: { OR: [{ role: "DEPARTMENT" }, { appointments: { some: appointmentScope(user) } }] },
    student: { role: "STUDENT", enrollments: { some: { level: { in: ["BACHELOR", "MASTER"] }, status: "ACTIVE" } } },
    postgrad: { role: "STUDENT", enrollments: { some: { level: "POSTGRAD", status: "ACTIVE" } } },
    supervisor: { OR: [{ role: "SUPERVISOR" }, { appointments: { some: appointmentScope(user) } }] },
  };
  const search: Prisma.PersonWhereInput = q ? { OR: [{ lastName: { contains: q, mode: "insensitive" } }, { login: { contains: q, mode: "insensitive" } }] } : {};
  const [people, total, faculties, departments, programs, groups, own] = await Promise.all([
    db.person.findMany({
      where: { AND: [staffListScope(user), byKind[kind], search] }, orderBy: [{ createdAt: "desc" }], take: 100,
      include: { staffFaculty: true, staffDepartment: true, supervisorProfile: true, appointments: { where: appointmentScope(user), include: { staffDepartment: true } }, enrollments: { where: { status: "ACTIVE" }, include: { group: true, program: true } } },
    }),
    db.person.count({ where: { AND: [staffListScope(user), byKind[kind]] } }),
    user.role === "RECTOR" ? db.faculty.findMany({ orderBy: { name: "asc" }, include: { staff: { where: { role: "DEAN_OFFICE", isHead: true }, select: { lastName: true, firstName: true, middleName: true } } } }) : Promise.resolve([]),
    user.role === "DEAN_OFFICE" ? db.department.findMany({ where: { facultyId: user.staffFacultyId ?? -1 }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    user.role === "DEAN_OFFICE"
      ? db.program.findMany({ where: { facultyId: user.staffFacultyId ?? -1, level: { in: ["BACHELOR", "MASTER"] } }, orderBy: [{ level: "asc" }, { direction: "asc" }] })
      : user.role === "DEPARTMENT" ? db.program.findMany({ where: { level: "POSTGRAD" }, orderBy: { specialtyCode: "asc" } }) : Promise.resolve([]),
    user.role === "DEAN_OFFICE" ? db.group.findMany({ where: { facultyId: user.staffFacultyId ?? -1 }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    db.person.findUniqueOrThrow({ where: { id: user.id }, include: { staffFaculty: true, staffDepartment: true } }),
  ]);
  // подразделение текущей должности (может быть дополнительной, SPEC §17)
  const unit = (user.staffDepartmentId != null ? (await db.department.findUnique({ where: { id: user.staffDepartmentId } }))?.name : null)
    ?? (user.staffFacultyId != null ? (await db.faculty.findUnique({ where: { id: user.staffFacultyId } }))?.name : null) ?? "МГИМО";
  // кем пользователь управляет по основной должности (пароль, ФИО); остальные в списке — совместители
  const managedIds = new Set((await db.person.findMany({ where: { AND: [{ id: { in: people.map((p) => p.id) } }, accountScope(user)] }, select: { id: true } })).map((p) => p.id));
  const ROLE_RU = { DEAN_OFFICE: "деканат", DEPARTMENT: "кафедра", SUPERVISOR: "преподаватель", RECTOR: "проректор", STUDENT: "студент" } as const;
  // дерево деканата и кого из него можно выбрать руководителем / кому сбросить пароль
  const tree = kind === "staff" && user.staffFacultyId != null ? await deanTree(user.staffFacultyId, true) : [];
  const managed = new Set(kind === "staff" ? (await db.person.findMany({ where: { AND: [accountScope(user), { role: "DEAN_OFFICE" }] }, select: { id: true } })).map((p) => p.id) : []);
  // анкеты сотрудников деканата для правки (только те, кем пользователь управляет)
  const staffCards = new Map((kind === "staff" ? await db.person.findMany({ where: { id: { in: [...managed] } } }) : []).map((p) => [p.id, p]));
  const initials = (p: { lastName: string; firstName: string; middleName: string | null }) => `${p.lastName} ${p.firstName[0]}.${p.middleName ? ` ${p.middleName[0]}.` : ""}`;
  const fio = (p: { lastName: string; firstName: string; middleName: string | null }) => `${p.lastName} ${p.firstName}${p.middleName ? " " + p.middleName : ""}`;
  // справочник должностей деканата: подсказки в формах; редактирует декан
  const positions = kind === "staff" && user.staffFacultyId != null ? await facultyPositions(user.staffFacultyId) : [];
  const managers = kind === "staff" ? [{ id: user.id, label: `Я — ${own.lastName} ${own.firstName}${own.position ? `, ${own.position.toLowerCase()}` : ""}` },
    ...(await db.person.findMany({ where: { id: { in: [...managed] } }, orderBy: { lastName: "asc" } })).map((p) => ({ id: p.id, label: `${p.lastName} ${p.firstName}${p.position ? `, ${p.position.toLowerCase()}` : ""}` }))] : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">Аккаунты</h1>
        <p className="text-sm text-muted-foreground">{unit}. Логин собирается из ФИО (Иванов Петр Владимирович → Ivanov_P_V), пароль одноразовый — при первом входе человек задаст свой.</p>
      </div>
      {kinds.length > 1 && (
        <nav className="flex gap-1 text-sm" aria-label="Вид аккаунтов">
          {kinds.map((k) => <Link key={k} href={`/staff/accounts?k=${k}`} aria-current={k === kind ? "page" : undefined} className={`rounded-sm px-3 py-2.5 ${k === kind ? "bg-navy font-semibold text-white" : "bg-muted"}`}>{KIND[k]}</Link>)}
        </nav>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-lg border p-4">
          <h2 className="mb-3 font-semibold text-navy">Создать: {KIND[kind].toLowerCase()}</h2>
          <CreateForm kind={kind}
            faculties={faculties.map((f) => ({ id: f.id, label: `${f.name}${f.staff[0] ? ` · декан ${initials(f.staff[0])}` : ""}` }))}
            departments={departments.map((d) => ({ id: d.id, label: d.name }))}
            programs={programs.map((p) => ({ id: p.id, label: `${p.specialtyCode ? p.specialtyCode + " " : ""}${p.direction}${p.name ? ` — ${p.name}` : ""}`, level: p.level }))}
            groups={groups.map((g) => ({ id: g.id, label: g.name, level: g.level, course: g.course }))}
            managers={managers} />
          {(kind === "department" || kind === "supervisor" || (kind === "staff" && user.isHead)) && (
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-1 text-sm font-semibold text-navy">Человек уже работает в системе?</h3>
              <p className="mb-3 text-xs text-muted-foreground">Назначьте его по логину на вторую должность — без нового логина и пароля. Должность он переключает в шапке кабинета.</p>
              <AppointExisting kind={kind} departments={departments.map((d) => ({ id: d.id, label: d.name }))} managers={managers} />
            </div>
          )}
        </div>
        {(kind === "student" || kind === "postgrad" || kind === "supervisor") && (
          <div className="min-w-0 rounded-lg border p-4">
            <h2 className="mb-1 font-semibold text-navy">{kind === "supervisor" ? "Кабинеты преподавателей из Excel" : "Загрузить списком из Excel"}</h2>
            <p className="mb-3 text-sm text-muted-foreground">Первая колонка — ФИО (или колонки «Фамилия», «Имя», «Отчество»){kind === "student" && ", можно колонку «Группа»"}{kind === "supervisor" && ", можно колонки «Должность» и «Степень»"}. Логины соберутся сами: Иванов Петр Владимирович → Ivanov_P_V. До 500 строк.</p>
            <BulkUpload kind={kind as "student" | "postgrad" | "supervisor"}
              programs={programs.map((p) => ({ id: p.id, label: `${p.specialtyCode ? p.specialtyCode + " " : ""}${p.direction}${p.name ? ` — ${p.name}` : ""}`, level: p.level }))}
              groups={groups.map((g) => ({ id: g.id, label: g.name, level: g.level, course: g.course }))} />
          </div>
        )}
      </section>

      {kind === "staff" && <datalist id="dean-positions">{positions.map((p) => <option key={p.id} value={p.name} />)}</datalist>}
      {kind === "staff" && user.isHead && (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-semibold text-navy">Должности деканата · {positions.length}</summary>
          <p className="my-3 text-sm text-muted-foreground">Это подсказки при создании сотрудника и правке анкеты. Переименование меняет должность и у сотрудников, которые её занимают; удаление — только убирает подсказку.</p>
          <PositionsEditor positions={positions.map((p) => ({ id: p.id, name: p.name }))} />
        </details>
      )}
      {kind === "staff" ? (
        <section>
          <h2 className="mb-2 font-semibold text-navy">Структура деканата</h2>
          <p className="mb-3 text-sm text-muted-foreground">Так её видят студенты в разделе «Мой деканат» (без логинов).{own.isHead ? " Вы — декан: правите анкеты и сбрасываете пароли всем сотрудникам деканата." : " Править анкеты и сбрасывать пароли можно своим прямым подчинённым."}</p>
          <div className="mb-3">
            <EditAccount mode="self" label="Моя карточка для студентов" person={{ id: own.id, fio: fio(own), duties: own.staffDuties, room: own.staffRoom, hours: own.staffHours, phone: own.workPhone }} />
          </div>
          {tree.length ? <DeanTreeView nodes={tree} action={(n) => {
            const c = staffCards.get(n.id);
            if (!c) return null;
            return (
              <div className="mt-2 flex flex-wrap items-start gap-2">
                <ResetButton id={n.id} />
                <EditAccount mode="staff" managers={managers} person={{ id: c.id, fio: fio(c), isHead: c.isHead, managerId: c.managerId, position: c.position, duties: c.staffDuties, room: c.staffRoom, hours: c.staffHours, phone: c.workPhone }} />
              </div>
            );
          }} /> : <p className="rounded-lg border p-4 text-sm text-muted-foreground">В деканате пока никого нет.</p>}
        </section>
      ) : (
      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold text-navy">{KIND[kind]} · {total}</h2>
          <form className="flex w-full gap-2 sm:w-auto">
            <input type="hidden" name="k" value={kind} />
            <label htmlFor="q" className="sr-only">Поиск</label>
            <input id="q" name="q" defaultValue={q} placeholder="Фамилия или логин" className="h-11 min-w-0 flex-1 rounded-sm border px-3" />
            <button type="submit" className="h-11 rounded-sm border px-4 text-sm font-semibold">Найти</button>
          </form>
        </div>
        {people.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">{q ? "Никого не нашли." : "Аккаунтов пока нет — создайте первый."}</p> : (
          <ul className="divide-y rounded-lg border">
            {people.map((p) => {
              const e = p.enrollments[0];
              const detail = p.role === "DEAN_OFFICE" ? p.staffFaculty?.name
                : p.role === "DEPARTMENT" || p.role === "SUPERVISOR" ? p.staffDepartment?.name
                : e ? `${LEVEL[e.level]}, ${e.course} курс${e.group ? ` · ${e.group.name}` : ""}${e.program ? ` · ${e.program.direction}` : ""}` : "";
              if (!managedIds.has(p.id)) return (
                // совместитель: основная должность в другом месте — пароль и ФИО меняет её руководитель
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <b className="text-navy">{p.lastName} {p.firstName} {p.middleName}</b>
                    <p className="text-sm"><code className="rounded-sm bg-muted px-1">{p.login}</code> <span className="text-muted-foreground">· {p.appointments.map((a) => a.staffDepartment.name).join(", ")}</span></p>
                    <p className="text-xs font-semibold text-brand-blue">Совместитель. Основная должность: {p.position ?? ROLE_RU[p.role]}{p.staffFaculty ? ` · ${p.staffFaculty.name}` : p.staffDepartment ? ` · ${p.staffDepartment.name}` : ""}. Пароль сбрасывает основной руководитель.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">{p.appointments.map((a) => <RemoveAppointment key={a.id} id={a.id} />)}</div>
                  {kind === "supervisor" && <EditAccount mode="supervisor-extra" label="Анкета преподавателя" person={{ id: p.id, fio: fio(p), position: p.supervisorProfile?.position, degree: p.supervisorProfile?.degree, interests: p.supervisorProfile?.interests, maxStudents: p.supervisorProfile?.maxStudents }} />}
                </li>
              );
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <b className="text-navy">{p.lastName} {p.firstName} {p.middleName}</b>
                    <p className="text-sm"><code className="rounded-sm bg-muted px-1">{p.login}</code> <span className="text-muted-foreground">· {detail}</span></p>
                    {p.mustChangePassword && <p className="text-xs font-semibold text-status-warn">Ещё не входил — пароль одноразовый</p>}
                    {p.appointments.length > 0 && <p className="text-xs font-semibold text-brand-blue">Совмещает: {p.appointments.map((a) => `${ROLE_RU[a.role]} · ${a.staffDepartment.name}`).join("; ")}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ResetButton id={p.id} />
                    {(kind === "dean" || kind === "department") && <DeleteAccountButton id={p.id} kind={kind} />}
                  </div>
                  {kind === "dean"
                    ? <EditAccount mode="dean" faculties={faculties.map((f) => ({ id: f.id, label: f.name }))} person={{ id: p.id, fio: fio(p), facultyId: p.staffFacultyId }} />
                    : kind === "supervisor"
                      ? <EditAccount mode="supervisor" person={{ id: p.id, fio: fio(p), position: p.supervisorProfile?.position, degree: p.supervisorProfile?.degree, interests: p.supervisorProfile?.interests, maxStudents: p.supervisorProfile?.maxStudents }} />
                      : <EditAccount mode="fio" label="Исправить ФИО" person={{ id: p.id, fio: fio(p) }} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}
    </div>
  );
}
