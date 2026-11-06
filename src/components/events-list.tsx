import { CalendarDays, MapPin, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { todayMsk } from "@/lib/time";

const fmt = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "short", weekday: "short" }).format(d);

/** Ближайшие мероприятия МГИМО — из снимка открытых анонсов mgimo.ru (data/mgimo-events.json). */
export async function EventsList({ limit = 4, compact = false }: { limit?: number; compact?: boolean }) {
  const events = await db.event.findMany({ where: { date: { gte: todayMsk() } }, orderBy: [{ date: "asc" }, { time: "asc" }], take: limit });
  return (
    <section aria-labelledby="events-h">
      <h2 id="events-h" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Мероприятия МГИМО</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ближайших мероприятий нет.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id}>
              <a href={e.url} target="_blank" rel="noopener noreferrer" className="group block rounded-lg border p-3 hover:bg-muted">
                <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-brand-blue">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{fmt(e.date)}{e.time ? `, ${e.time}` : ""}</span>
                  {e.place && <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="size-3.5" aria-hidden />{e.place}</span>}
                </p>
                <h3 className="mt-1 line-clamp-3 text-sm font-semibold leading-snug text-navy">{e.title}</h3>
                {!compact && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.summary}</p>}
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-navy">mgimo.ru <ExternalLink className="size-3" aria-hidden /></span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
