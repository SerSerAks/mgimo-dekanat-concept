import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { markAllRead } from "@/app/actions/notifications";

/** Лента уведомлений — общая для студентов и сотрудников. */
export async function NotificationsView({ personId, base, onlyUnread, tagFor }: { personId: string; base: string; onlyUnread: boolean; tagFor?: (link: string | null) => string | null }) {
  const [list, unread] = await Promise.all([
    db.notification.findMany({ where: { personId, ...(onlyUnread ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.notification.count({ where: { personId, readAt: null } }),
  ]);
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">Уведомления</h1>
        {unread > 0 && <form action={markAllRead}><button type="submit" className="h-11 rounded-sm border px-3 text-sm font-semibold text-navy">Прочитать всё</button></form>}
      </div>
      <nav className="flex gap-1 text-sm" aria-label="Фильтр">
        <Link href={base} aria-current={!onlyUnread ? "page" : undefined} className={`rounded-sm px-3 py-2 ${!onlyUnread ? "bg-secondary font-semibold text-navy" : "text-muted-foreground"}`}>Все</Link>
        <Link href={`${base}?unread=1`} aria-current={onlyUnread ? "page" : undefined} className={`rounded-sm px-3 py-2 ${onlyUnread ? "bg-secondary font-semibold text-navy" : "text-muted-foreground"}`}>Непрочитанные {unread > 0 && unread}</Link>
      </nav>
      {list.length === 0 && <p className="rounded-lg border p-4 text-sm text-muted-foreground">{onlyUnread ? "Вы всё прочитали." : "Уведомлений пока нет."}</p>}
      <ul className="space-y-2">
        {list.map((n) => (
          <li key={n.id}>
            <a href={`/notifications/${n.id}`} className={`block rounded-lg border p-4 hover:bg-muted ${n.readAt ? "" : "border-navy/40 bg-secondary/50"}`}>
              <div className="flex justify-between gap-2">
                <b className={n.title.startsWith("Важно") ? "text-brand-red" : "text-navy"}>{!n.readAt && <span className="mr-1.5 inline-block size-2 rounded-full bg-brand-red align-middle" aria-label="не прочитано" />}{n.title}</b>
                <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</span>
              </div>
              <p className="text-sm">{n.body}</p>
              {tagFor?.(n.link) && <span className="mt-1 inline-block rounded-sm bg-muted px-1.5 py-0.5 text-xs font-semibold text-navy">{tagFor(n.link)}</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
