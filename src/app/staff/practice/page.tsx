import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { deletePractice } from "@/app/actions/practice";
import { PracticeForm } from "./practice-form";

const LEVEL = { BACHELOR: "Бакалавриат", MASTER: "Магистратура", POSTGRAD: "Аспирантура" } as const;
const fmt = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(d);

export default async function StaffPractice() {
  const user = await requireUser(["DEAN_OFFICE"]);
  const fid = user.staffFacultyId ?? -1;
  const [faculty, periods, programs] = await Promise.all([
    db.faculty.findUnique({ where: { id: fid } }),
    db.practicePeriod.findMany({ where: { facultyId: fid }, include: { program: true }, orderBy: [{ level: "asc" }, { course: "asc" }, { startDate: "asc" }] }),
    db.program.findMany({ where: { facultyId: fid }, orderBy: [{ level: "asc" }, { direction: "asc" }] }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Практика</h1>
        <p className="text-sm text-muted-foreground">{faculty?.name}. Сроки видят студенты на «Учебном процессе»; если задан период для направления, он заменяет общий.</p>
      </div>
      {periods.length === 0 ? <p className="rounded-lg border p-4 text-sm">Периодов практики пока нет.</p> : (
        <ul className="divide-y rounded-lg border">
          {periods.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{LEVEL[p.level]}, {p.course} курс · {p.kind}</p>
                <b className="text-navy">{p.title}</b>
                <p className="text-sm">{fmt(p.startDate)} — {fmt(p.endDate)}{p.docsDeadline && <> · документы до {fmt(p.docsDeadline)}</>}</p>
                <p className="text-sm text-muted-foreground">{p.program ? `Только направление: ${p.program.direction}${p.program.name ? ` (${p.program.name})` : ""}` : "Все направления факультета"}</p>
              </div>
              <form action={deletePractice}><input type="hidden" name="id" value={p.id} /><button type="submit" className="h-11 rounded-sm border px-3 text-sm text-brand-red">Удалить</button></form>
            </li>
          ))}
        </ul>
      )}
      <section>
        <h2 className="mb-2 font-semibold text-navy">Добавить период</h2>
        <PracticeForm programs={programs.map((p) => ({ id: p.id, label: `${LEVEL[p.level]}: ${p.direction}${p.name ? ` — ${p.name}` : ""}` }))} />
      </section>
    </div>
  );
}
