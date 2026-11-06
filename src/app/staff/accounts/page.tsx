import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountScope, creatableKinds } from "@/lib/access";
import { CreateForm, BulkUpload, ResetButton } from "./account-forms";

const KIND = { dean: "Деканаты", department: "Кафедры", student: "Студенты", postgrad: "Аспиранты", supervisor: "Научные руководители" } as const;
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
    department: { role: "DEPARTMENT" },
    student: { role: "STUDENT", enrollments: { some: { level: { in: ["BACHELOR", "MASTER"] }, status: "ACTIVE" } } },
    postgrad: { role: "STUDENT", enrollments: { some: { level: "POSTGRAD", status: "ACTIVE" } } },
    supervisor: { role: "SUPERVISOR" },
  };
  const search: Prisma.PersonWhereInput = q ? { OR: [{ lastName: { contains: q, mode: "insensitive" } }, { login: { contains: q, mode: "insensitive" } }] } : {};
  const [people, total, faculties, departments, programs, groups, own] = await Promise.all([
    db.person.findMany({
      where: { AND: [accountScope(user), byKind[kind], search] }, orderBy: [{ createdAt: "desc" }], take: 100,
      include: { staffFaculty: true, staffDepartment: true, enrollments: { where: { status: "ACTIVE" }, include: { group: true, program: true } } },
    }),
    db.person.count({ where: { AND: [accountScope(user), byKind[kind]] } }),
    user.role === "RECTOR" ? db.faculty.findMany({ orderBy: { name: "asc" }, include: { staff: { where: { role: "DEAN_OFFICE" }, select: { id: true } } } }) : Promise.resolve([]),
    user.role === "DEAN_OFFICE" ? db.department.findMany({ where: { facultyId: user.staffFacultyId ?? -1 }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    user.role === "DEAN_OFFICE"
      ? db.program.findMany({ where: { facultyId: user.staffFacultyId ?? -1, level: { in: ["BACHELOR", "MASTER"] } }, orderBy: [{ level: "asc" }, { direction: "asc" }] })
      : user.role === "DEPARTMENT" ? db.program.findMany({ where: { level: "POSTGRAD" }, orderBy: { specialtyCode: "asc" } }) : Promise.resolve([]),
    user.role === "DEAN_OFFICE" ? db.group.findMany({ where: { facultyId: user.staffFacultyId ?? -1 }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    db.person.findUniqueOrThrow({ where: { id: user.id }, include: { staffFaculty: true, staffDepartment: true } }),
  ]);
  const unit = own.staffDepartment?.name ?? own.staffFaculty?.name ?? "МГИМО";

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
            faculties={faculties.map((f) => ({ id: f.id, label: `${f.name}${f.staff.length ? ` · уже есть ${f.staff.length}` : ""}` }))}
            departments={departments.map((d) => ({ id: d.id, label: d.name }))}
            programs={programs.map((p) => ({ id: p.id, label: `${p.specialtyCode ? p.specialtyCode + " " : ""}${p.direction}${p.name ? ` — ${p.name}` : ""}`, level: p.level }))}
            groups={groups.map((g) => ({ id: g.id, label: g.name, level: g.level, course: g.course }))} />
        </div>
        {(kind === "student" || kind === "postgrad") && (
          <div className="min-w-0 rounded-lg border p-4">
            <h2 className="mb-1 font-semibold text-navy">Загрузить списком из Excel</h2>
            <p className="mb-3 text-sm text-muted-foreground">Первая колонка — ФИО (или колонки «Фамилия», «Имя», «Отчество»){kind === "student" && ", можно колонку «Группа»"}. До 500 строк.</p>
            <BulkUpload kind={kind}
              programs={programs.map((p) => ({ id: p.id, label: `${p.specialtyCode ? p.specialtyCode + " " : ""}${p.direction}${p.name ? ` — ${p.name}` : ""}`, level: p.level }))}
              groups={groups.map((g) => ({ id: g.id, label: g.name, level: g.level, course: g.course }))} />
          </div>
        )}
      </section>

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
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <b className="text-navy">{p.lastName} {p.firstName} {p.middleName}</b>
                    <p className="text-sm"><code className="rounded-sm bg-muted px-1">{p.login}</code> <span className="text-muted-foreground">· {detail}</span></p>
                    {p.mustChangePassword && <p className="text-xs font-semibold text-status-warn">Ещё не входил — пароль одноразовый</p>}
                  </div>
                  <ResetButton id={p.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
