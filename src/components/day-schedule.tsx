import { fmtShort } from "@/lib/time";
import { toMin, type DayItem } from "@/lib/schedule";
import { noteText } from "@/lib/lesson-note";

/**
 * Расписание дня одним списком. Изменения показаны прямо в строке пары:
 * отмена — зачёркнута, перенос — старое время зачёркнуто и новое рядом, смена аудитории — старая зачёркнута.
 * nowMin задаётся только для сегодняшнего дня: тогда подсвечиваются идущая/следующая пары, прошедшие приглушаются.
 */
export function DaySchedule({ items, nowMin }: { items: DayItem[]; nowMin?: number }) {
  const active = items.filter((i) => !i.movedAway && i.lesson.change !== "CANCELLED");
  const current = nowMin != null ? active.find((i) => toMin(i.time) <= nowMin && nowMin < toMin(i.end)) : undefined;
  const next = nowMin != null && !current ? active.find((i) => toMin(i.time) > nowMin) : undefined;

  if (items.length === 0) return <p className="rounded-lg border p-4 text-sm text-muted-foreground">Пар нет</p>;

  return (
    <ol className="divide-y rounded-lg border">
      {items.map((it) => {
        const l = it.lesson;
        const off = it.movedAway || l.change === "CANCELLED";
        const past = nowMin != null && toMin(it.end) <= nowMin;
        const isCur = it === current;
        const isNext = it === next;
        const mins = isNext && nowMin != null ? toMin(it.time) - nowMin : 0;
        return (
          <li key={`${l.id}-${it.movedAway}`}
            className={`relative grid grid-cols-[64px_1fr] gap-3 p-3 sm:p-4 ${isCur || isNext ? "bg-secondary" : ""} ${past && !isCur ? "opacity-55" : ""}`}
            aria-current={isCur ? "time" : undefined}>
            {(isCur || isNext) && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-navy" />}
            <div className="text-sm leading-tight">
              <div className={`font-bold ${off ? "text-muted-foreground line-through" : "text-brand-blue"}`}>{it.time}</div>
              <div className={`text-muted-foreground ${off ? "line-through" : ""}`}>{it.end}</div>
              {l.change === "MOVED" && !it.movedAway && l.prevStart && (
                <div className="mt-1 text-xs text-muted-foreground line-through">{l.prevStart}</div>
              )}
            </div>
            <div className="min-w-0">
              {isCur && <p className="text-xs font-bold uppercase tracking-wide text-navy">Идёт сейчас</p>}
              {isNext && <p className="text-xs font-bold uppercase tracking-wide text-navy">Следующая · {mins < 60 ? `через ${mins} мин` : `в ${it.time}`}</p>}
              <h3 className={`font-semibold ${off ? "text-muted-foreground line-through" : "text-navy"}`}>{l.discipline}</h3>
              <p className="text-sm">
                <span className="text-muted-foreground">{l.kind} · </span>
                {l.change === "ROOM" && l.prevAuditorium ? (
                  <>ауд. <s className="text-muted-foreground">{l.prevAuditorium}</s> <b className="text-brand-red">{l.auditorium}</b></>
                ) : (
                  <span className={off ? "line-through" : ""}>ауд. <b>{l.auditorium}</b></span>
                )}
                <span className="text-muted-foreground"> · {l.building}</span>
              </p>
              {l.teacher && <p className="truncate text-sm text-muted-foreground">{l.teacher.name}</p>}
              {l.change !== "NONE" && (
                <p className="mt-1 text-sm font-medium text-brand-red">
                  {l.change === "CANCELLED" && "Отменена. "}
                  {it.movedAway && `Перенесена на ${fmtShort(l.date)}, ${l.start}. `}
                  {l.change === "MOVED" && !it.movedAway && l.prevDate && `Перенесена с ${fmtShort(l.prevDate)}. `}
                  {l.change === "ROOM" && "Смена аудитории. "}
                  <span className="font-normal">{noteText(l.changeNote)}</span>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
