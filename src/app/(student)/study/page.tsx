import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { gradeScope } from "@/lib/access";
import { practiceFor } from "@/lib/practice";
import { PASS_THRESHOLD } from "@/config/grading";

const CT = { EXAM: "Экзамен", CREDIT: "Зачёт", GRADED_CREDIT: "Зачёт с оценкой" } as const;
const TABS = [["current", "Текущие оценки"], ["exams", "Экзамены"], ["credits", "Зачёты"], ["process", "Учебный процесс"]] as const;
type Tab = (typeof TABS)[number][0];
type Comp = { name: string; max: number; score: number | null };

const fmtD = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(d);
const fmtDT = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);

export default async function StudyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireStudent();
  const e = user.enrollment;
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.find(([k]) => k === requested)?.[0] ?? "current";
  const grades = await db.grade.findMany({ where: { ...gradeScope(user), enrollmentId: e.id }, orderBy: [{ semester: "desc" }, { discipline: "asc" }] });
  const current = grades.filter((g) => g.mark == null);
  const closed = grades.filter((g) => g.mark != null);
  const exams = closed.filter((g) => g.controlType === "EXAM");
  const credits = closed.filter((g) => g.controlType !== "EXAM");
  const debts = closed.filter((g) => g.isDebt);
  const numeric = closed.filter((g) => /^[2-5]$/.test(g.mark ?? "")).map((g) => Number(g.mark));
  const avg = numeric.length ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(2) : null;
  const atRisk = current.filter((g) => (g.score ?? 0) < 0.6 * ((g.components as Comp[]).filter((c) => c.score != null).reduce((a, c) => a + c.max, 0)));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">Успеваемость</h1>
        <span className="flex gap-4 text-sm font-semibold text-brand-blue"><Link href="/supervisor">Научный руководитель</Link><Link href="/antiplagiat">Антиплагиат</Link></span>
      </div>

      {/* «Как у меня дела» — одной строкой */}
      <section className="grid grid-cols-3 gap-2" aria-label="Сводка">
        <Stat label="Средняя оценка" value={avg ?? "—"} hint={avg ? "по закрытым семестрам" : "сессий ещё не было"} />
        <Stat label="Долги" value={String(debts.length)} tone={debts.length ? "bad" : "ok"} hint={debts.length ? "нужно пересдать" : "нет"} />
        <Stat label="В зоне риска" value={String(atRisk.length)} tone={atRisk.length ? "warn" : "ok"} hint="баллов меньше 60%" />
      </section>
      {debts.length > 0 && (
        <p className="rounded-lg border border-brand-red/40 bg-brand-red/5 p-3 text-sm">
          Долг: <b>{debts.map((d) => d.discipline).join(", ")}</b>. <Link href="/requests/new/retake" className="font-semibold text-brand-blue">Записаться на пересдачу →</Link>
        </p>
      )}

      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm" aria-label="Разделы успеваемости">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/study?tab=${k}`} aria-current={tab === k ? "page" : undefined}
            className={`shrink-0 rounded-sm px-3 py-2.5 ${tab === k ? "bg-navy font-semibold text-white" : "bg-muted text-foreground"}`}>{label}</Link>
        ))}
      </nav>

      {tab === "current" && (current.length === 0 ? <Empty text="В этом семестре оценок пока нет." /> : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{current[0].semester}-й семестр идёт. Баллы обновляются по мере выставления.</p>
          <div className="hidden overflow-hidden rounded-lg border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="p-3">Дисциплина</th><th className="p-3">Контроль</th>{(current[0].components as Comp[]).map((c) => <th key={c.name} className="p-3 text-right">{c.name}</th>)}<th className="p-3 text-right">Итого</th></tr>
              </thead>
              <tbody className="divide-y">
                {current.map((g) => (
                  <tr key={g.id} className={atRisk.includes(g) ? "bg-status-warn/5" : ""}>
                    <td className="p-3 font-medium text-navy">{g.discipline}</td>
                    <td className="p-3 text-muted-foreground">{CT[g.controlType]}</td>
                    {(g.components as Comp[]).map((c) => <td key={c.name} className="p-3 text-right tabular-nums">{c.score ?? "—"}<span className="text-muted-foreground">/{c.max}</span></td>)}
                    <td className="p-3 text-right font-bold tabular-nums">{g.score}<span className="font-normal text-muted-foreground">/100</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {current.map((g) => (
              <li key={g.id} className={`rounded-lg border p-4 ${atRisk.includes(g) ? "border-status-warn/50" : ""}`}>
                <div className="flex justify-between gap-3"><b className="text-navy">{g.discipline}</b><span className="shrink-0 font-bold tabular-nums">{g.score}/100</span></div>
                <p className="text-xs text-muted-foreground">{CT[g.controlType]}{atRisk.includes(g) && <span className="text-status-warn"> · в зоне риска</span>}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  {(g.components as Comp[]).map((c) => <div key={c.name}><dt className="text-muted-foreground">{c.name}</dt><dd className="font-semibold tabular-nums">{c.score ?? "—"}/{c.max}</dd></div>)}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {(tab === "exams" || tab === "credits") && <ClosedTable list={tab === "exams" ? exams : credits} empty={tab === "exams" ? "Экзаменов пока не было — первая сессия впереди." : "Зачётов пока не было."} />}

      {tab === "process" && <Process e={e} grades={current} />}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "ok" | "warn" | "bad" }) {
  const c = tone === "bad" ? "text-brand-red" : tone === "warn" ? "text-status-warn" : "text-navy";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${c}`}>{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>
    </div>
  );
}

const Empty = ({ text }: { text: string }) => <p className="rounded-lg border p-4 text-sm text-muted-foreground">{text}</p>;

function ClosedTable({ list, empty }: { list: { id: number; semester: number; discipline: string; controlType: keyof typeof CT; score: number | null; mark: string | null; ects: string | null; isDebt: boolean }[]; empty: string }) {
  if (!list.length) return <Empty text={empty} />;
  const sems = [...new Set(list.map((g) => g.semester))];
  return (
    <div className="space-y-5">
      {sems.map((s) => (
        <section key={s}>
          <h2 className="mb-2 font-semibold text-navy">{s}-й семестр</h2>
          <table className="w-full overflow-hidden rounded-lg border text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Дисциплина</th><th className="hidden p-3 sm:table-cell">Контроль</th><th className="p-3 text-right">Балл</th><th className="p-3 text-right">Оценка</th></tr>
            </thead>
            <tbody className="divide-y">
              {list.filter((g) => g.semester === s).map((g) => (
                <tr key={g.id} className={g.isDebt ? "bg-brand-red/5" : ""}>
                  <td className="p-3 font-medium text-navy">{g.discipline}{g.isDebt && <span className="block text-xs font-normal text-brand-red">долг — нужна пересдача</span>}</td>
                  <td className="hidden p-3 text-muted-foreground sm:table-cell">{CT[g.controlType]}</td>
                  <td className="p-3 text-right tabular-nums">{g.score ?? "—"}</td>
                  <td className={`p-3 text-right font-bold ${g.isDebt ? "text-brand-red" : "text-navy"}`}>{g.mark}{g.ects && <span className="ml-1 text-xs font-normal text-muted-foreground">{g.ects}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">Порог сдачи — {PASS_THRESHOLD} баллов из 100. Шкала перевода — условная (концепт).</p>
    </div>
  );
}

async function Process({ e, grades }: { e: { id: string; groupId: number | null; languageSubgroup: string | null; facultyId: number; level: "BACHELOR" | "MASTER" | "POSTGRAD"; course: number; programId: number | null }; grades: { discipline: string; controlType: keyof typeof CT }[] }) {
  const semStart = new Date("2026-09-01T00:00:00Z"), semEnd = new Date("2026-12-31T00:00:00Z");
  const [byDisc, exams, practice] = await Promise.all([
    e.groupId ? db.lesson.groupBy({
      by: ["discipline", "kind"], _count: true,
      where: { groupId: e.groupId, date: { gte: semStart, lte: semEnd }, OR: [{ subgroup: null }, ...(e.languageSubgroup ? [{ subgroup: e.languageSubgroup }] : [])] },
    }) : Promise.resolve([]),
    e.groupId ? db.exam.findMany({ where: { groupId: e.groupId }, orderBy: { at: "asc" } }) : Promise.resolve([]),
    practiceFor(e),
  ]);
  // учебный план семестра — из реального расписания: 1 пара = 2 академических часа
  const plan = new Map<string, { lec: number; sem: number }>();
  for (const r of byDisc) {
    const p = plan.get(r.discipline) ?? { lec: 0, sem: 0 };
    if (/лекц/i.test(r.kind)) p.lec += r._count * 2; else p.sem += r._count * 2;
    plan.set(r.discipline, p);
  }
  const control = new Map(grades.map((g) => [g.discipline, CT[g.controlType]]));
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-semibold text-navy">Ключевые даты семестра</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-3">
          <li className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Занятия</p><b>1 сен — 31 дек 2026</b></li>
          <li className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Сессия</p><b>{exams.length ? `${fmtD(exams[0].at)} — ${fmtD(exams[exams.length - 1].at)}` : "по графику факультета"}</b></li>
          <li className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Практика</p><b>{practice.length ? `${fmtD(practice[0].startDate)} — ${fmtD(practice[0].endDate)}` : "в этом году нет"}</b></li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-navy">Практика</h2>
        {practice.length === 0 ? <Empty text="На вашем курсе практики нет." /> : (
          <ul className="space-y-2">
            {practice.map((p) => (
              <li key={p.id} className="rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{p.kind}</p>
                <b className="text-navy">{p.title}</b>
                <p className="text-sm">{fmtD(p.startDate)} — {fmtD(p.endDate)}{p.docsDeadline && <> · место согласовать до <b>{fmtD(p.docsDeadline)}</b></>}</p>
                {p.note && <p className="text-sm text-muted-foreground">{p.note}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold text-brand-blue">
                  <Link href="/requests/new/practice_place">Согласовать место →</Link>
                  <Link href="/requests/new/practice_referral">Получить направление →</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-navy">Сессия</h2>
        {exams.length === 0 ? <Empty text="Расписание сессии ещё не опубликовано." /> : (
          <ul className="divide-y rounded-lg border text-sm">
            {exams.map((x) => (
              <li key={x.id} className={`grid grid-cols-[110px_1fr] gap-3 p-3 ${x.kind === "Консультация" ? "text-muted-foreground" : ""}`}>
                <span className="tabular-nums">{fmtDT(x.at)}</span>
                <span><b className={x.kind === "Консультация" ? "font-medium" : "text-navy"}>{x.kind}</b> · {x.discipline} · ауд. {x.auditorium}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold text-navy">Дисциплины семестра</h2>
        {plan.size === 0 ? <Empty text="Аудиторных занятий в этом семестре нет." /> : (
          <table className="w-full overflow-hidden rounded-lg border text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Дисциплина</th><th className="p-3 text-right">Лекции</th><th className="p-3 text-right">Семинары</th><th className="hidden p-3 sm:table-cell">Контроль</th></tr>
            </thead>
            <tbody className="divide-y">
              {[...plan.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru")).map(([d, h]) => (
                <tr key={d}><td className="p-3 font-medium text-navy">{d}</td><td className="p-3 text-right tabular-nums">{h.lec || "—"}</td><td className="p-3 text-right tabular-nums">{h.sem || "—"}</td><td className="hidden p-3 text-muted-foreground sm:table-cell">{control.get(d) ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Часы посчитаны по расписанию семестра (открытые данные РУЗ): 1 пара = 2 ак. часа.</p>
      </section>
    </div>
  );
}
