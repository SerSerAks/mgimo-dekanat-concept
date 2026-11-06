import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireStudent } from "@/lib/auth";
import { dayItems, hasChanges, lessonsFor, toMin } from "@/lib/schedule";
import { addDays, fmtDay, nowHHMM, todayMsk, weekParity, weekStart } from "@/lib/time";
import { DaySchedule } from "@/components/day-schedule";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

/**
 * По умолчанию — один день (сегодня; в воскресенье — понедельник).
 * Полоса дней недели сверху: сегодня выделено, у дней с изменениями — красная точка.
 * ?view=week — вся неделя списком.
 */
export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ d?: string; view?: string }> }) {
  const user = await requireStudent();
  const sp = await searchParams;
  const today = todayMsk();
  const fallback = today.getUTCDay() === 0 ? addDays(today, 1) : today;
  const parsed = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? new Date(sp.d + "T00:00:00Z") : null;
  let day = parsed && !isNaN(parsed.getTime()) ? parsed : fallback;
  if (day.getUTCDay() === 0) day = addDays(day, 1);
  const week = weekStart(day);
  const days = Array.from({ length: 6 }, (_, i) => addDays(week, i));
  const lessons = await lessonsFor(user.enrollment, week, addDays(week, 7));
  const p = weekParity(week);
  const weekView = sp.view === "week";
  const isToday = (d: Date) => d.getTime() === today.getTime();
  const link = (d: Date, extra = "") => `/schedule?d=${iso(d)}${extra}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-navy">Расписание</h1>
          <p className="text-sm text-muted-foreground">{p.number}-я неделя семестра, {p.label}</p>
        </div>
        <nav className="flex gap-1 text-sm" aria-label="Вид">
          <Link href={link(day)} aria-current={!weekView ? "page" : undefined} className={`rounded-sm px-3 py-2.5 ${!weekView ? "bg-navy font-semibold text-white" : "bg-muted"}`}>День</Link>
          <Link href={link(day, "&view=week")} aria-current={weekView ? "page" : undefined} className={`rounded-sm px-3 py-2.5 ${weekView ? "bg-navy font-semibold text-white" : "bg-muted"}`}>Неделя</Link>
        </nav>
      </header>

      {/* полоса дней недели */}
      <div className="flex items-center gap-1">
        <Link href={link(addDays(week, -7), weekView ? "&view=week" : "")} aria-label="Предыдущая неделя" className="grid size-11 shrink-0 place-items-center rounded-sm border"><ChevronLeft className="size-5" aria-hidden /></Link>
        <ol className="grid flex-1 grid-cols-6 gap-1">
          {days.map((d, i) => {
            const sel = !weekView && d.getTime() === day.getTime();
            const changed = hasChanges(dayItems(lessons, d));
            const count = dayItems(lessons, d).filter((x) => !x.movedAway && x.lesson.change !== "CANCELLED").length;
            return (
              <li key={i}>
                <Link href={weekView ? `#d-${iso(d)}` : link(d)} aria-current={sel ? "date" : undefined}
                  aria-label={`${fmtDay(d)}${isToday(d) ? ", сегодня" : ""}: ${count} пар${changed ? ", есть изменения" : ""}`}
                  className={`relative flex h-14 flex-col items-center justify-center rounded-sm text-sm ${sel ? "bg-navy text-white" : isToday(d) ? "border-2 border-navy text-navy" : "border"}`}>
                  <span className="text-[11px] uppercase opacity-80">{WD[i]}</span>
                  <span className="font-bold tabular-nums">{d.getUTCDate()}</span>
                  {changed && <span aria-hidden className={`absolute right-1 top-1 size-2 rounded-full ${sel ? "bg-white" : "bg-brand-red"}`} />}
                </Link>
              </li>
            );
          })}
        </ol>
        <Link href={link(addDays(week, 7), weekView ? "&view=week" : "")} aria-label="Следующая неделя" className="grid size-11 shrink-0 place-items-center rounded-sm border"><ChevronRight className="size-5" aria-hidden /></Link>
      </div>
      {!days.some(isToday) && <Link href="/schedule" className="inline-block text-sm font-semibold text-brand-blue">← Вернуться к сегодня</Link>}

      {weekView ? days.map((d) => (
        <section key={iso(d)} id={`d-${iso(d)}`} className="scroll-mt-20">
          <h2 className={`mb-2 font-semibold first-letter:uppercase ${isToday(d) ? "text-brand-red" : "text-navy"}`}>{fmtDay(d)}{isToday(d) && " · сегодня"}</h2>
          <DaySchedule items={dayItems(lessons, d)} nowMin={isToday(d) ? toMin(nowHHMM()) : undefined} />
        </section>
      )) : (
        <section>
          <h2 className={`mb-2 font-semibold first-letter:uppercase ${isToday(day) ? "text-brand-red" : "text-navy"}`}>{fmtDay(day)}{isToday(day) && " · сегодня"}</h2>
          <DaySchedule items={dayItems(lessons, day)} nowMin={isToday(day) ? toMin(nowHHMM()) : undefined} />
          <div className="mt-3 flex justify-between text-sm font-semibold text-brand-blue">
            {day.getUTCDay() !== 1 ? <Link href={link(addDays(day, -1))}>← {WD[(day.getUTCDay() + 5) % 7]}</Link> : <Link href={link(addDays(day, -2))}>← Сб</Link>}
            {day.getUTCDay() !== 6 ? <Link href={link(addDays(day, 1))}>{WD[day.getUTCDay() % 7]} →</Link> : <Link href={link(addDays(day, 2))}>Пн →</Link>}
          </div>
        </section>
      )}
    </div>
  );
}
