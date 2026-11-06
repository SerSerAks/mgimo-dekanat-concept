import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { supervisorRequestScope } from "@/lib/access";
import { campaignsFor, workLabel } from "@/lib/campaigns";
import { withdrawSupervisorRequest } from "@/app/actions/supervision";
import { fmtDateTime } from "@/lib/time";
import { RequestSupervisor } from "./request-supervisor";

const ST = { PENDING: ["Ждёт ответа", "bg-status-progress"], ACCEPTED: ["Принята", "bg-status-ok"], DECLINED: ["Отклонена", "bg-status-bad"], WITHDRAWN: ["Отозвана", "bg-status-new"] } as const;
const TOPIC = { NONE: "не выбрана", PENDING: "на утверждении кафедры", APPROVED: "утверждена", RETURNED: "возвращена на доработку" } as const;
const fmt = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "long" }).format(d);
const fio = (p: { lastName: string; firstName: string; middleName: string | null }) => `${p.lastName} ${p.firstName} ${p.middleName ?? ""}`.trim();

export default async function SupervisorPage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const user = await requireStudent();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const e = await db.enrollment.findFirstOrThrow({
    where: { id: user.enrollment.id, personId: user.id },
    include: { supervisor: { include: { supervisorProfile: true, staffDepartment: true } }, thesis: true },
  });
  const [camps, requests] = await Promise.all([
    campaignsFor(db, e),
    db.supervisorRequest.findMany({ where: supervisorRequestScope(user), orderBy: { createdAt: "desc" }, include: { supervisor: { select: { lastName: true, firstName: true, middleName: true } }, campaign: true } }),
  ]);
  const active = camps.find((c) => String(c.id) === sp.c) ?? camps[0];

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">Научный руководитель</h1>
        <p className="text-sm text-muted-foreground">Договоритесь с преподавателем лично и закрепите договорённость заявкой.</p>
      </div>

      {e.supervisor && (
        <section className="rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{workLabel("THESIS", e.level)}</p>
          <b className="text-navy">{fio(e.supervisor)}</b>
          <p className="text-sm">{e.supervisor.supervisorProfile?.position}{e.supervisor.supervisorProfile?.degree ? `, ${e.supervisor.supervisorProfile.degree}` : ""} · {e.supervisor.staffDepartment?.name}</p>
          {e.thesis?.topic && <p className="mt-1 text-sm">Тема: «{e.thesis.topic}» — {TOPIC[e.thesis.topicStatus]}</p>}
        </section>
      )}

      {camps.length === 0 ? (
        !e.supervisor && <p className="rounded-lg border p-4 text-sm">В этом учебном году на вашем курсе выбирать руководителя не нужно. Когда деканат загрузит план с курсовой или ВКР, здесь появится выбор и придёт уведомление.</p>
      ) : (
        <>
          {camps.length > 1 && (
            <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm" aria-label="Вид работы">
              {camps.map((c) => (
                <Link key={c.id} href={`/supervisor?c=${c.id}`} aria-current={c.id === active.id ? "page" : undefined}
                  className={`shrink-0 rounded-sm px-3 py-2.5 ${c.id === active.id ? "bg-navy font-semibold text-white" : "bg-muted"}`}>{workLabel(c.workType, c.level)}</Link>
              ))}
            </nav>
          )}
          <Campaign campaign={active} enrollment={e} requests={requests.filter((r) => r.campaignId === active.id)} q={q} />
        </>
      )}

      <History requests={requests} />
    </div>
  );
}

async function Campaign({ campaign: c, enrollment: e, requests, q }: {
  campaign: Awaited<ReturnType<typeof campaignsFor>>[number];
  enrollment: { supervisorId: string | null; level: "BACHELOR" | "MASTER" | "POSTGRAD" };
  requests: { id: string; status: keyof typeof ST; topic: string; createdAt: Date; supervisor: { lastName: string; firstName: string; middleName: string | null } }[];
  q: string;
}) {
  const accepted = requests.find((r) => r.status === "ACCEPTED");
  const pending = requests.find((r) => r.status === "PENDING");
  const late = c.chooseBy < new Date();
  const header = (
    <div className="rounded-lg bg-secondary p-4">
      <b className="text-navy">{workLabel(c.workType, c.level)} · {c.academicYear}</b>
      <p className="text-sm">Выбрать руководителя до <b className={late ? "text-brand-red" : ""}>{fmt(c.chooseBy)}</b>{late && " — срок прошёл, напишите в деканат"} · руководители открывают приём до {fmt(c.openBy)}</p>
    </div>
  );
  if (c.workType === "THESIS" && e.supervisorId) return <>{header}<p className="rounded-lg border p-4 text-sm">Руководитель выпускной работы уже закреплён — см. выше.</p></>;
  if (accepted) return <>{header}<section className="rounded-lg border border-status-ok/40 bg-status-ok/5 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-status-ok">Руководитель выбран</p><b className="text-navy">{fio(accepted.supervisor)}</b><p className="text-sm">Тема: «{accepted.topic}»</p></section></>;
  if (pending) return (
    <>{header}
      <section className="rounded-lg border border-status-progress/40 bg-status-progress/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-status-progress">Заявка ждёт ответа</p>
        <b className="text-navy">{fio(pending.supervisor)}</b>
        <p className="text-sm">«{pending.topic}» · отправлена {fmtDateTime(pending.createdAt)}</p>
        <form action={withdrawSupervisorRequest} className="mt-2"><input type="hidden" name="id" value={pending.id} /><button type="submit" className="h-11 rounded-sm border px-3 text-sm">Отозвать заявку</button></form>
      </section>
    </>
  );

  const intakes = await db.supervisorIntake.findMany({
    where: {
      campaignId: c.id,
      ...(q ? { supervisor: { OR: [{ lastName: { contains: q, mode: "insensitive" } }, { supervisorProfile: { interests: { contains: q, mode: "insensitive" } } }] } } : {}),
    },
    include: { supervisor: { include: { supervisorProfile: true, staffDepartment: true } } },
    orderBy: { supervisor: { lastName: "asc" } },
  });
  const taken = await db.supervisorRequest.groupBy({ by: ["supervisorId"], where: { campaignId: c.id, status: "ACCEPTED" }, _count: true });
  const takenBy = new Map(taken.map((t) => [t.supervisorId, t._count]));
  return (
    <>
      {header}
      <form className="flex gap-2">
        <input type="hidden" name="c" value={c.id} />
        <label htmlFor="q" className="sr-only">Поиск</label>
        <input id="q" name="q" defaultValue={q} placeholder="Фамилия или тема: «политология», «право»…" className="h-11 flex-1 rounded-sm border px-3" />
        <button type="submit" className="h-11 rounded-sm border px-4 text-sm font-semibold">Найти</button>
      </form>
      {intakes.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm">{q ? "Никого не нашли — попробуйте другое слово." : `Руководители ещё не открыли приём. Это нужно сделать до ${fmt(c.openBy)} — мы пришлём уведомление.`}</p>
      ) : (
        <ul className="space-y-3">
          {intakes.map(({ supervisor: s, slots }) => {
            const p = s.supervisorProfile!;
            const free = Math.max(0, slots - (takenBy.get(s.id) ?? 0));
            return (
              <li key={s.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <b className="text-navy">{fio(s)}</b>
                    <p className="text-sm">{p.position}{p.degree ? `, ${p.degree}` : ""}</p>
                    <p className="text-sm text-muted-foreground">{s.staffDepartment?.name}</p>
                  </div>
                  <span className={`shrink-0 rounded-sm px-2 py-1 text-xs font-semibold text-white ${free ? "bg-status-ok" : "bg-status-new"}`}>{free ? `свободно ${free} из ${slots}` : "мест нет"}</span>
                </div>
                <p className="mt-2 text-sm"><span className="text-muted-foreground">Интересы:</span> {p.interests}</p>
                {free > 0 && !late && <RequestSupervisor campaignId={c.id} supervisorId={s.id} name={`${s.lastName} ${s.firstName[0]}. ${s.middleName?.[0] ?? ""}.`} />}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function History({ requests }: { requests: { id: string; status: keyof typeof ST; topic: string; reply: string | null; createdAt: Date; campaign: { workType: "COURSEWORK" | "THESIS" | "NIR"; level: "BACHELOR" | "MASTER" | "POSTGRAD" } | null; supervisor: { lastName: string; firstName: string } }[] }) {
  const past = requests.filter((r) => r.status === "DECLINED" || r.status === "WITHDRAWN");
  if (!past.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">История заявок</h2>
      <ul className="divide-y rounded-lg border">
        {past.map((r) => (
          <li key={r.id} className="p-3 text-sm">
            <div className="flex justify-between gap-2"><b className="text-navy">{r.supervisor.lastName} {r.supervisor.firstName}</b><span className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold text-white ${ST[r.status][1]}`}>{ST[r.status][0]}</span></div>
            <p>{r.campaign ? `${workLabel(r.campaign.workType, r.campaign.level)} · ` : ""}«{r.topic}» · {fmtDateTime(r.createdAt)}</p>
            {r.reply && <p className="text-muted-foreground">Ответ: {r.reply}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
