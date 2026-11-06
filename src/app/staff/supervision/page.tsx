import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { supervisorRequestScope } from "@/lib/access";
import { fmtDateTime } from "@/lib/time";
import { DecideForm } from "./decide-form";

const LEVEL = { BACHELOR: "бакалавр", MASTER: "магистрант", POSTGRAD: "аспирант" } as const;
const ST = { ACCEPTED: ["Принята", "bg-status-ok"], DECLINED: ["Отклонена", "bg-status-bad"], WITHDRAWN: ["Отозвана студентом", "bg-status-new"] } as const;

export default async function SupervisionInbox() {
  const user = await requireUser(["SUPERVISOR"]);
  const [list, profile, taken] = await Promise.all([
    db.supervisorRequest.findMany({
      where: supervisorRequestScope(user), orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { enrollment: { include: { person: { select: { lastName: true, firstName: true, middleName: true } }, group: true, program: true, grades: { select: { mark: true, isDebt: true } } } } },
    }),
    db.supervisorProfile.findUnique({ where: { personId: user.id } }),
    db.enrollment.count({ where: { supervisorId: user.id, status: "ACTIVE" } }),
  ]);
  const pending = list.filter((r) => r.status === "PENDING");
  const past = list.filter((r) => r.status !== "PENDING");
  const full = profile ? taken >= profile.maxStudents : false;
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">Заявки студентов</h1>
        {profile && <p className="text-sm text-muted-foreground">Занято мест: {taken} из {profile.maxStudents}{full && " — мест нет, принять новую заявку нельзя"}</p>}
      </div>
      {pending.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Новых заявок нет.</p> : (
        <ul className="space-y-3">
          {pending.map((r) => {
            const e = r.enrollment, p = e.person;
            const marks = e.grades.map((g) => Number(g.mark)).filter((m) => m >= 2 && m <= 5);
            const avg = marks.length ? (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(1) : "—";
            return (
              <li key={r.id} className="rounded-lg border p-4">
                <b className="text-navy">{p.lastName} {p.firstName} {p.middleName}</b>
                <p className="text-sm">{LEVEL[e.level]}, {e.course} курс · {e.group?.name ?? "—"}{e.program ? ` · ${e.program.direction}` : ""}</p>
                <p className="text-sm text-muted-foreground">Средняя оценка: {avg} · долгов: {e.grades.filter((g) => g.isDebt).length} · {fmtDateTime(r.createdAt)}</p>
                <p className="mt-2"><span className="text-sm text-muted-foreground">Тема:</span> <b>«{r.topic}»</b></p>
                <p className="mt-1 whitespace-pre-line rounded-sm bg-muted p-3 text-sm">{r.message}</p>
                <DecideForm id={r.id} canAccept={!full} />
              </li>
            );
          })}
        </ul>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Обработанные</h2>
          <ul className="divide-y rounded-lg border">
            {past.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 p-3 text-sm">
                <span>{r.enrollment.person.lastName} {r.enrollment.person.firstName} · «{r.topic}»</span>
                <span className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold text-white ${ST[r.status as keyof typeof ST][1]}`}>{ST[r.status as keyof typeof ST][0]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
