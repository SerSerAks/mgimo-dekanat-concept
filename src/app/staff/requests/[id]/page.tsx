import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestScope } from "@/lib/access";
import { REQUEST_TYPES, requestTypeLabel, STATUS } from "@/lib/requests";
import { DEAN_TRANSITIONS } from "@/lib/request-flow";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/time";
import { StatusActions } from "./status-actions";

const LEVEL = { BACHELOR: "бакалавриат", MASTER: "магистратура", POSTGRAD: "аспирантура" } as const;

export default async function StaffRequest({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["DEAN_OFFICE"]);
  const { id } = await params;
  const r = await db.request.findFirst({
    where: { id, ...requestScope(user) },
    include: {
      enrollment: { include: { person: { select: { lastName: true, firstName: true, middleName: true } }, group: true, program: true } },
      events: { orderBy: { createdAt: "asc" }, include: { author: { select: { role: true, lastName: true } } } },
    },
  });
  if (!r) notFound(); // заявка другого факультета неотличима от несуществующей
  const e = r.enrollment, p = e.person, def = REQUEST_TYPES[r.type];
  const payload = r.payload as Record<string, unknown>;
  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/staff/requests" className="text-sm text-brand-blue">← Все заявки</Link>
      <div>
        <p className="text-sm text-muted-foreground">Заявка №{r.number} · {fmtDateTime(r.createdAt)}</p>
        <h1 className="text-2xl font-bold text-navy">{requestTypeLabel(r.type)}</h1>
        <Badge className={`mt-2 rounded-sm text-white ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</Badge>
      </div>
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Студент</h2>
        <p className="font-semibold text-navy">{p.lastName} {p.firstName} {p.middleName}</p>
        <p className="text-sm">{LEVEL[e.level]}, {e.course} курс · {e.group?.name ?? "—"} · {e.studyForm}, {e.funding}</p>
        {e.program && <p className="text-sm text-muted-foreground">{e.program.direction}{e.program.name ? ` — ${e.program.name}` : ""}</p>}
        <p className="text-sm text-muted-foreground">Студенческий: {e.studentCardNo}</p>
      </section>
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Что просит</h2>
        <dl className="divide-y rounded-lg border text-sm">
          {def?.fields.filter((f) => payload[f.name] !== undefined && payload[f.name] !== "").map((f) => (
            <div key={f.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-muted-foreground">{f.label}</dt><dd className="font-medium break-words">{String(payload[f.name])}</dd></div>
          ))}
          {def?.delivery && <div className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-muted-foreground">Как получить</dt><dd className="font-medium">{r.delivery}</dd></div>}
        </dl>
      </section>
      {DEAN_TRANSITIONS[r.status] && <StatusActions key={r.status} id={r.id} transitions={DEAN_TRANSITIONS[r.status]!} delivery={r.delivery} />}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">История</h2>
        <ol className="space-y-2 border-l-2 border-navy/20 pl-4">
          {r.events.map((ev) => (
            <li key={ev.id}>
              <b className="text-navy">{STATUS[ev.status].label}</b> <span className="text-sm text-muted-foreground">{fmtDateTime(ev.createdAt)}{ev.author && ` · ${ev.author.role === "STUDENT" ? "студент" : "деканат"}`}</span>
              {ev.comment && <p className="text-sm">{ev.comment}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
