import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignScope } from "@/lib/access";
import { ACADEMIC_YEAR, campaignStudents, facultySupervisors, workLabel } from "@/lib/campaigns";
import { LoadPlanButton, CampaignDates } from "./plan-forms";

const LEVEL = { BACHELOR: "Бакалавриат", MASTER: "Магистратура", POSTGRAD: "Аспирантура" } as const;
const fmt = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "short" }).format(d);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function StaffPlan() {
  const user = await requireUser(["DEAN_OFFICE"]);
  const camps = await db.supervisionCampaign.findMany({
    where: { ...campaignScope(user), academicYear: ACADEMIC_YEAR }, orderBy: [{ level: "asc" }, { course: "asc" }, { workType: "asc" }],
    include: { program: true, intakes: true, requests: { where: { status: "ACCEPTED", enrollment: { status: "ACTIVE" } }, select: { enrollmentId: true } } },
  });
  const rows = await Promise.all(camps.map(async (c) => {
    const [studs, sups] = await Promise.all([campaignStudents(db, c), facultySupervisors(db, c.facultyId, c.level)]);
    const chosenSet = new Set(c.requests.map((r) => r.enrollmentId));
    const chosen = studs.filter((s) => chosenSet.has(s.id) || (c.workType === "THESIS" && s.supervisorId)).length;
    return { c, students: studs.length, chosen, supervisors: sups.length, opened: c.intakes.length, slots: c.intakes.reduce((a, i) => a + i.slots, 0) };
  }));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">Учебный план {ACADEMIC_YEAR}: научное руководство</h1>
        <p className="text-sm text-muted-foreground">После загрузки плана руководители получают напоминание открыть приём, а студенты — выбрать руководителя. Дальше сервер сам напоминает тем, кто не успел.</p>
      </div>
      <LoadPlanButton loaded={camps.length > 0} />
      {rows.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">План на {ACADEMIC_YEAR} ещё не загружен.</p> : (
        <ul className="space-y-3">
          {rows.map(({ c, students, chosen, supervisors, opened, slots }) => (
            <li key={c.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{LEVEL[c.level]}, {c.course} курс{c.program ? ` · ${c.program.direction}` : ""}</p>
                  <b className="text-navy">{workLabel(c.workType, c.level)}</b>
                  <p className="text-sm">Открыть приём до <b>{fmt(c.openBy)}</b> · выбрать до <b>{fmt(c.chooseBy)}</b></p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <Progress label="Руководители открыли приём" value={opened} total={supervisors} />
                <Progress label="Студенты выбрали руководителя" value={chosen} total={students} />
                <div className="rounded-sm bg-muted p-2"><dt className="text-xs text-muted-foreground">Мест открыто</dt><dd className="font-bold tabular-nums">{slots}</dd></div>
              </dl>
              <CampaignDates id={c.id} openBy={iso(c.openBy)} chooseBy={iso(c.chooseBy)} />
            </li>
          ))}
        </ul>
      )}
    </div>
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
