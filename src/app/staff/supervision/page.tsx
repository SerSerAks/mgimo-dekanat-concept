import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { supervisorRequestScope } from "@/lib/access";
import { ACADEMIC_YEAR, workLabel } from "@/lib/campaigns";
import { closeIntake } from "@/app/actions/supervision";
import { fmtDateTime } from "@/lib/time";
import { DecideForm } from "./decide-form";
import { IntakeForm } from "./intake-form";

const LEVEL = { BACHELOR: "бакалавр", MASTER: "магистрант", POSTGRAD: "аспирант" } as const;
const ST = { ACCEPTED: ["Принята", "bg-status-ok"], DECLINED: ["Отклонена", "bg-status-bad"], WITHDRAWN: ["Отозвана студентом", "bg-status-new"] } as const;
const fmt = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "long" }).format(d);

export default async function SupervisionInbox() {
  const user = await requireUser(["SUPERVISOR"]);
  const me = await db.person.findUniqueOrThrow({ where: { id: user.id }, include: { staffDepartment: true, supervisorProfile: true } });
  const levels = me.supervisorProfile?.levels ?? [];
  const [list, camps] = await Promise.all([
    db.supervisorRequest.findMany({
      where: supervisorRequestScope(user), orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { campaign: true, enrollment: { include: { person: { select: { lastName: true, firstName: true, middleName: true } }, group: true, program: true, grades: { select: { mark: true, isDebt: true } } } } },
    }),
    db.supervisionCampaign.findMany({
      where: { facultyId: me.staffDepartment?.facultyId ?? -1, OR: [{ departmentId: null }, { departmentId: me.staffDepartmentId ?? -1 }], academicYear: ACADEMIC_YEAR, level: { in: levels } },
      orderBy: [{ openBy: "asc" }],
      include: { intakes: { where: { supervisorId: user.id } }, requests: { where: { supervisorId: user.id, status: "ACCEPTED" }, select: { id: true } } },
    }),
  ]);
  const pending = list.filter((r) => r.status === "PENDING");
  const past = list.filter((r) => r.status !== "PENDING");
  const today = new Date();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-navy">Заявки студентов</h1>

      <section aria-labelledby="intake">
        <h2 id="intake" className="mb-2 font-semibold text-navy">Приём студентов · {ACADEMIC_YEAR}</h2>
        {camps.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Деканат ещё не загрузил учебный план — приём открывать пока не нужно.</p> : (
          <ul className="space-y-2">
            {camps.map((c) => {
              const intake = c.intakes[0];
              const late = !intake && c.openBy < today;
              return (
                <li key={c.id} className={`rounded-lg border p-4 ${!intake ? (late ? "border-brand-red/50" : "border-status-warn/50") : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <b className="text-navy">{workLabel(c.workType, c.level)}, {c.course} курс</b>
                      <p className="text-sm text-muted-foreground">Студенты выбирают до {fmt(c.chooseBy)}</p>
                    </div>
                    {intake
                      ? <span className="rounded-sm bg-status-ok px-2 py-1 text-xs font-semibold text-white">Открыт · занято {c.requests.length} из {intake.slots}</span>
                      : <span className={`rounded-sm px-2 py-1 text-xs font-semibold text-white ${late ? "bg-brand-red" : "bg-status-warn"}`}>{late ? "Срок открытия прошёл" : `Откройте до ${fmt(c.openBy)}`}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <IntakeForm campaignId={c.id} slots={intake?.slots ?? 3} open={!!intake} />
                    {intake && <form action={closeIntake}><input type="hidden" name="campaignId" value={c.id} /><button type="submit" className="h-11 rounded-sm border px-3 text-sm">Закрыть приём</button></form>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="inbox">
        <h2 id="inbox" className="mb-2 font-semibold text-navy">Новые заявки</h2>
        {pending.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Новых заявок нет.</p> : (
          <ul className="space-y-3">
            {pending.map((r) => {
              const e = r.enrollment, p = e.person;
              const marks = e.grades.map((g) => Number(g.mark)).filter((m) => m >= 2 && m <= 5);
              const avg = marks.length ? (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(1) : "—";
              return (
                <li key={r.id} className="rounded-lg border p-4">
                  {r.campaign && <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{workLabel(r.campaign.workType, r.campaign.level)}</p>}
                  <b className="text-navy">{p.lastName} {p.firstName} {p.middleName}</b>
                  <p className="text-sm">{LEVEL[e.level]}, {e.course} курс · {e.group?.name ?? "—"}{e.program ? ` · ${e.program.direction}` : ""}</p>
                  <p className="text-sm text-muted-foreground">Средняя оценка: {avg} · долгов: {e.grades.filter((g) => g.isDebt).length} · {fmtDateTime(r.createdAt)}</p>
                  <p className="mt-2"><span className="text-sm text-muted-foreground">Тема:</span> <b>«{r.topic}»</b></p>
                  <p className="mt-1 whitespace-pre-line rounded-sm bg-muted p-3 text-sm">{r.message}</p>
                  <DecideForm id={r.id} canAccept />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Обработанные</h2>
          <ul className="divide-y rounded-lg border">
            {past.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 p-3 text-sm">
                <span>{r.enrollment.person.lastName} {r.enrollment.person.firstName} · {r.campaign ? workLabel(r.campaign.workType, r.campaign.level).toLowerCase() : "работа"} · «{r.topic}»</span>
                <span className={`shrink-0 self-start rounded-sm px-2 py-0.5 text-xs font-semibold text-white ${ST[r.status as keyof typeof ST][1]}`}>{ST[r.status as keyof typeof ST][0]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
