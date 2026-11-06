import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ACADEMIC_YEAR, campaignStudents, campaignSupervisors, workLabel } from "@/lib/campaigns";
import { CampaignDates } from "./plan-forms";

const LEVEL = { BACHELOR: "Бакалавриат", MASTER: "Магистратура", POSTGRAD: "Аспирантура" } as const;
const fmt = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "short" }).format(d);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Кампании с прогрессом: сколько руководителей открыли приём и сколько студентов выбрали. Общий список для деканата и кафедры. */
export async function loadCampaigns(where: Prisma.SupervisionCampaignWhereInput) {
  const camps = await db.supervisionCampaign.findMany({
    where: { ...where, academicYear: ACADEMIC_YEAR }, orderBy: [{ level: "asc" }, { course: "asc" }, { workType: "asc" }],
    include: { program: true, department: true, intakes: true, requests: { where: { status: "ACCEPTED", enrollment: { status: "ACTIVE" } }, select: { enrollmentId: true } }, _count: { select: { requests: true } } },
  });
  return Promise.all(camps.map(async (c) => {
    const [studs, sups] = await Promise.all([campaignStudents(db, c), campaignSupervisors(db, c)]);
    const chosenSet = new Set(c.requests.map((r) => r.enrollmentId));
    const chosen = studs.filter((s) => chosenSet.has(s.id) || (c.workType === "THESIS" && s.supervisorId)).length;
    return { c, students: studs.length, chosen, supervisors: sups.length, opened: c.intakes.length, slots: c.intakes.reduce((a, i) => a + i.slots, 0) };
  }));
}

type Row = Awaited<ReturnType<typeof loadCampaigns>>[number];

export function CampaignList({ rows, canEdit, extra }: { rows: Row[]; canEdit: (c: Row["c"]) => boolean; extra?: (c: Row["c"]) => React.ReactNode }) {
  return (
    <ul className="space-y-3">
      {rows.map(({ c, students, chosen, supervisors, opened, slots }) => (
        <li key={c.id} className="rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{LEVEL[c.level]}, {c.course} курс{c.program ? ` · ${c.program.direction}` : ""}</p>
          <b className="text-navy">{workLabel(c.workType, c.level)}</b>
          {c.department && <p className="text-sm text-muted-foreground">Загрузила {c.department.name.toLowerCase()}</p>}
          <p className="text-sm">Открыть приём до <b>{fmt(c.openBy)}</b> · выбрать до <b>{fmt(c.chooseBy)}</b></p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <Progress label="Руководители открыли приём" value={opened} total={supervisors} />
            <Progress label="Студенты выбрали руководителя" value={chosen} total={students} />
            <div className="rounded-sm bg-muted p-2"><dt className="text-xs text-muted-foreground">Мест открыто</dt><dd className="font-bold tabular-nums">{slots}</dd></div>
          </dl>
          {canEdit(c) && <CampaignDates id={c.id} openBy={iso(c.openBy)} chooseBy={iso(c.chooseBy)} />}
          {extra?.(c)}
        </li>
      ))}
    </ul>
  );
}

function Progress({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-sm bg-muted p-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-bold tabular-nums">{value} из {total}</dd>
      <div className="mt-1 h-1.5 rounded-full bg-background" aria-hidden><div className="h-1.5 rounded-full bg-navy" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
