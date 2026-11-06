import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayItems, hasChanges, lessonsFor, toMin } from "@/lib/schedule";
import { addDays, fmtDay, fmtShort, nowHHMM, todayMsk, weekParity } from "@/lib/time";
import { DaySchedule } from "@/components/day-schedule";
import { EventsList } from "@/components/events-list";
import { requestTypeLabel } from "@/lib/requests";
import { campaignsFor, workLabel } from "@/lib/campaigns";

export default async function TodayPage() {
  const user = await requireStudent();
  const today = todayMsk();
  const tomorrow = addDays(today, 1);
  const nowMin = toMin(nowHHMM());
  const [lessons, ahead, ready, unread] = await Promise.all([
    lessonsFor(user.enrollment, today, addDays(today, 2)),
    lessonsFor(user.enrollment, addDays(today, 1), addDays(today, 14)),
    db.request.findMany({ where: { enrollmentId: user.enrollment.id, status: "READY" }, orderBy: { updatedAt: "desc" } }),
    db.notification.findMany({ where: { personId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  // кампании, где руководитель ещё не выбран (нет принятой заявки; для ВКР — нет закреплённого руководителя)
  const camps = await campaignsFor(db, user.enrollment);
  const accepted = new Set((await db.supervisorRequest.findMany({ where: { enrollmentId: user.enrollment.id, status: "ACCEPTED" }, select: { campaignId: true } })).map((r) => r.campaignId));
  const toChoose = camps.filter((c) => !accepted.has(c.id) && !(c.workType === "THESIS" && user.enrollment.supervisorId) && c.chooseBy >= today);
  const todayItems = dayItems(lessons, today);
  const tomorrowItems = dayItems(lessons, tomorrow);
  const nextDay = todayItems.length === 0 ? ahead.find((l) => l.change !== "CANCELLED") : undefined;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{fmtDay(today)} · {weekParity(today).label}</p>
        <h1 className="text-2xl font-bold text-navy">Привет, {user.firstName}!</h1>
      </section>

      {toChoose.map((c) => (
        <Link key={c.id} href={`/supervisor?c=${c.id}`} className="block rounded-lg border border-navy/30 bg-secondary p-4 hover:bg-muted">
          <b className="text-navy">Выберите научного руководителя: {workLabel(c.workType, c.level).toLowerCase()}</b>
          <p className="text-sm">Срок — до {new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "long" }).format(c.chooseBy)}. Договоритесь с преподавателем и отправьте заявку →</p>
        </Link>
      ))}

      {ready.length > 0 && (
        <section aria-labelledby="ready">
          <h2 id="ready" className="mb-2 text-xs font-semibold uppercase tracking-wide text-status-ok">Готово</h2>
          <ul className="space-y-2">
            {ready.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="block rounded-lg border border-status-ok/40 bg-status-ok/5 p-4 hover:bg-muted">
                  <b className="text-navy">{requestTypeLabel(r.type)}</b> готова{r.pickupPlace ? ` — заберите: ${r.pickupPlace}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="today-h">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="today-h" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Расписание на сегодня</h2>
          <Link href="/schedule" className="text-sm font-medium text-brand-blue">Вся неделя →</Link>
        </div>
        {todayItems.length ? <DaySchedule items={todayItems} nowMin={nowMin} /> : (
          <p className="rounded-lg border p-4 text-sm">
            Сегодня пар нет.{nextDay && <> Ближайшая — {fmtShort(nextDay.date)}, {nextDay.start}: <b>{nextDay.discipline}</b>.</>}
          </p>
        )}
      </section>

      {hasChanges(tomorrowItems) && (
        <section aria-labelledby="tomorrow-h">
          <h2 id="tomorrow-h" className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-red">Завтра есть изменения · {fmtShort(tomorrow)}</h2>
          <DaySchedule items={tomorrowItems} />
        </section>
      )}

      <section aria-labelledby="news">
        <h2 id="news" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Новое для вас</h2>
        {unread.length ? (
          <ul className="space-y-2">
            {unread.map((n) => (
              <li key={n.id} className="rounded-lg border p-4">
                <b className="text-navy">{n.title}</b>
                <p className="text-sm">{n.body}</p>
                <a href={`/notifications/${n.id}`} className="text-sm font-medium text-brand-blue">{n.link ? "Открыть →" : "Прочитано ✓"}</a>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Вы всё прочитали.</p>}
      </section>

      {/* на телефоне мероприятия здесь, на компьютере — в левой колонке */}
      <div className="md:hidden"><EventsList limit={3} /></div>
    </div>
  );
}
