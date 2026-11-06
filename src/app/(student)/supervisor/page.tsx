import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { canChooseSupervisor, supervisorRequestScope } from "@/lib/access";
import { withdrawSupervisorRequest } from "@/app/actions/supervision";
import { fmtDateTime } from "@/lib/time";
import { RequestSupervisor } from "./request-supervisor";

const ST = { PENDING: ["Ждёт ответа", "bg-status-progress"], ACCEPTED: ["Принята", "bg-status-ok"], DECLINED: ["Отклонена", "bg-status-bad"], WITHDRAWN: ["Отозвана", "bg-status-new"] } as const;
const TOPIC = { NONE: "не выбрана", PENDING: "на утверждении кафедры", APPROVED: "утверждена", RETURNED: "возвращена на доработку" } as const;

export default async function SupervisorPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireStudent();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const e = await db.enrollment.findFirstOrThrow({
    where: { id: user.enrollment.id, personId: user.id },
    include: { supervisor: { include: { supervisorProfile: true, staffDepartment: true } }, thesis: true },
  });
  const requests = await db.supervisorRequest.findMany({
    where: supervisorRequestScope(user), orderBy: { createdAt: "desc" },
    include: { supervisor: { select: { lastName: true, firstName: true, middleName: true } } },
  });
  const pending = requests.find((r) => r.status === "PENDING");

  if (e.supervisor) {
    const s = e.supervisor;
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-navy">Научный руководитель</h1>
        <section className="rounded-lg border p-4">
          <b className="text-lg text-navy">{s.lastName} {s.firstName} {s.middleName}</b>
          <p className="text-sm">{s.supervisorProfile?.position}{s.supervisorProfile?.degree ? `, ${s.supervisorProfile.degree}` : ""} · {s.staffDepartment?.name}</p>
          {s.supervisorProfile && <p className="mt-1 text-sm text-muted-foreground">Интересы: {s.supervisorProfile.interests}</p>}
        </section>
        {e.thesis && (
          <section className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Тема работы</p>
            <b className="text-navy">{e.thesis.topic ?? "—"}</b>
            <p className="text-sm">Статус темы: <b>{TOPIC[e.thesis.topicStatus]}</b></p>
          </section>
        )}
        <History requests={requests} />
      </div>
    );
  }

  if (!canChooseSupervisor(e)) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold text-navy">Научный руководитель</h1>
        <p className="rounded-lg border p-4 text-sm">Руководителя выбирают с 3 курса бакалавриата — для курсовых и выпускной работы. Пока этот раздел вам не нужен.</p>
      </div>
    );
  }

  const sups = await db.person.findMany({
    where: {
      role: "SUPERVISOR", staffDepartment: { facultyId: e.facultyId }, supervisorProfile: { levels: { has: e.level } },
      ...(q ? { OR: [{ lastName: { contains: q, mode: "insensitive" } }, { supervisorProfile: { interests: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    include: { supervisorProfile: true, staffDepartment: true, _count: { select: { supervised: { where: { status: "ACTIVE" } } } } },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">Выбор научного руководителя</h1>
        <p className="text-sm text-muted-foreground">Договоритесь с преподавателем и отправьте заявку. Одновременно — одна заявка.</p>
      </div>
      {pending && (
        <section className="rounded-lg border border-status-progress/40 bg-status-progress/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-status-progress">Заявка ждёт ответа</p>
          <b className="text-navy">{pending.supervisor.lastName} {pending.supervisor.firstName} {pending.supervisor.middleName}</b>
          <p className="text-sm">Тема: «{pending.topic}» · отправлена {fmtDateTime(pending.createdAt)}</p>
          <form action={withdrawSupervisorRequest} className="mt-2"><input type="hidden" name="id" value={pending.id} /><button type="submit" className="h-11 rounded-sm border px-3 text-sm">Отозвать заявку</button></form>
        </section>
      )}
      <form className="flex gap-2">
        <label htmlFor="q" className="sr-only">Поиск</label>
        <input id="q" name="q" defaultValue={q} placeholder="Фамилия или тема: «политология», «право»…" className="h-11 flex-1 rounded-sm border px-3" />
        <button type="submit" className="h-11 rounded-sm border px-4 text-sm font-semibold">Найти</button>
      </form>
      {sups.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Никого не нашли. Попробуйте другое слово.</p> : (
        <ul className="space-y-3">
          {sups.map((s) => {
            const p = s.supervisorProfile!;
            const free = Math.max(0, p.maxStudents - s._count.supervised);
            return (
              <li key={s.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <b className="text-navy">{s.lastName} {s.firstName} {s.middleName}</b>
                    <p className="text-sm">{p.position}{p.degree ? `, ${p.degree}` : ""}</p>
                    <p className="text-sm text-muted-foreground">{s.staffDepartment?.name}</p>
                  </div>
                  <span className={`shrink-0 rounded-sm px-2 py-1 text-xs font-semibold text-white ${free ? "bg-status-ok" : "bg-status-new"}`}>{free ? `свободно ${free} из ${p.maxStudents}` : "мест нет"}</span>
                </div>
                <p className="mt-2 text-sm"><span className="text-muted-foreground">Интересы:</span> {p.interests}</p>
                {free > 0 && !pending && <RequestSupervisor supervisorId={s.id} name={`${s.lastName} ${s.firstName[0]}. ${s.middleName?.[0] ?? ""}.`} />}
              </li>
            );
          })}
        </ul>
      )}
      <History requests={requests} />
      <p className="text-xs text-muted-foreground">Не нашли своего руководителя? Он может быть на другом факультете — напишите в деканат. <Link href="/requests/new" className="text-brand-blue">Заявки →</Link></p>
    </div>
  );
}

function History({ requests }: { requests: { id: string; status: keyof typeof ST; topic: string; reply: string | null; createdAt: Date; supervisor: { lastName: string; firstName: string } }[] }) {
  const past = requests.filter((r) => r.status !== "PENDING");
  if (!past.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">История заявок</h2>
      <ul className="divide-y rounded-lg border">
        {past.map((r) => (
          <li key={r.id} className="p-3 text-sm">
            <div className="flex justify-between gap-2"><b className="text-navy">{r.supervisor.lastName} {r.supervisor.firstName}</b><span className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold text-white ${ST[r.status][1]}`}>{ST[r.status][0]}</span></div>
            <p>«{r.topic}» · {fmtDateTime(r.createdAt)}</p>
            {r.reply && <p className="text-muted-foreground">Ответ: {r.reply}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
