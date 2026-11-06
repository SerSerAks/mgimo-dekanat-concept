import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { enrollmentScope } from "@/lib/access";

const LEVEL = { BACHELOR: "бакалавриат", MASTER: "магистратура", POSTGRAD: "аспирантура" } as const;

export default async function StaffPeople({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser(["DEAN_OFFICE"]);
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const list = await db.enrollment.findMany({
    where: {
      AND: [enrollmentScope(user), q ? { OR: [{ person: { lastName: { contains: q, mode: "insensitive" } } }, { group: { name: { contains: q, mode: "insensitive" } } }] } : {}],
    },
    include: {
      person: { select: { lastName: true, firstName: true, middleName: true } }, group: true, program: true,
      grades: { where: { isDebt: true }, select: { id: true } },
      requests: { where: { status: { in: ["NEW", "IN_PROGRESS", "NEEDS_INFO"] } }, select: { id: true } },
    },
    orderBy: [{ course: "asc" }, { person: { lastName: "asc" } }],
    take: 100,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Студенты факультета</h1>
      <form className="flex gap-2">
        <label htmlFor="q" className="sr-only">Поиск</label>
        <input id="q" name="q" defaultValue={q} placeholder="Фамилия или группа" className="h-11 flex-1 rounded-sm border px-3" />
        <button type="submit" className="h-11 rounded-sm border px-4 text-sm font-semibold">Найти</button>
      </form>
      {list.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Никого не нашли.</p> : (
        <ul className="divide-y rounded-lg border">
          {list.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <span className="min-w-0">
                <b className="text-navy">{e.person.lastName} {e.person.firstName} {e.person.middleName}</b>
                <span className="block text-sm text-muted-foreground">{LEVEL[e.level]}, {e.course} курс · {e.group?.name ?? "—"}{e.program ? ` · ${e.program.direction}` : ""}</span>
              </span>
              <span className="flex gap-2 text-xs">
                {e.grades.length > 0 && <span className="rounded-sm bg-brand-red px-2 py-1 font-semibold text-white">долгов: {e.grades.length}</span>}
                {e.requests.length > 0 && <span className="rounded-sm bg-status-progress px-2 py-1 font-semibold text-white">заявок: {e.requests.length}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
