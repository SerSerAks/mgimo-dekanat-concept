import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestScope } from "@/lib/access";
import { REQUEST_TYPES, requestTypeLabel, STATUS, TRACK } from "@/lib/requests";
import { cancelRequest } from "@/app/actions/requests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/time";
import { AnswerForm } from "./answer-form";

const STATUS_TEXT: Record<string, string> = {
  NEW: "Заявка отправлена. Деканат возьмёт её в работу в течение рабочего дня.",
  IN_PROGRESS: "Деканат готовит документ.",
  NEEDS_INFO: "Деканату нужно уточнение — смотрите комментарий ниже.",
  READY: "Готово!",
  ISSUED: "Документ выдан.",
  REJECTED: "Заявку отклонили — причина ниже. Можно подать заново.",
  CANCELLED: "Вы отменили заявку.",
};

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireStudent();
  const { id } = await params;
  const created = (await searchParams).created === "1";
  // id из адреса всегда объединяется с областью доступа: чужая заявка = 404.
  const r = await db.request.findFirst({ where: { id, ...requestScope(user) }, include: { events: { orderBy: { createdAt: "asc" } } } });
  if (!r) notFound();
  const def = REQUEST_TYPES[r.type];
  const reached = new Map(r.events.map((e) => [e.status, e.createdAt]));
  const offTrack = !TRACK.includes(r.status as (typeof TRACK)[number]) && r.status !== "NEEDS_INFO";
  const payload = r.payload as Record<string, unknown>;
  const lastComment = [...r.events].reverse().find((e) => e.comment)?.comment;

  return (
    <div className="max-w-xl space-y-5">
      <Link href="/requests" className="text-sm text-brand-blue">← Мои заявки</Link>
      {created && <p role="status" className="rounded-lg border border-status-ok/40 bg-status-ok/5 p-4 text-sm"><b>Заявка №{r.number} принята.</b> Мы пришлём уведомление, когда статус изменится.</p>}
      <div>
        <p className="text-sm text-muted-foreground">Заявка №{r.number} · {fmtDateTime(r.createdAt)}</p>
        <h1 className="text-2xl font-bold text-navy">{requestTypeLabel(r.type)}</h1>
        <Badge className={`mt-2 rounded-sm text-white ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</Badge>
        <p className="mt-2">{STATUS_TEXT[r.status]}{r.status === "READY" && (r.pickupPlace ? ` Заберите: ${r.pickupPlace}.` : r.delivery === "электронно" ? " PDF-документ доступен ниже." : "")}</p>
        {r.dueDate && ["NEW", "IN_PROGRESS"].includes(r.status) && <p className="text-sm text-muted-foreground">Ориентировочно готово к {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(r.dueDate)}</p>}
      </div>

      {lastComment && <p className="rounded-lg border border-status-warn/40 bg-status-warn/5 p-4 text-sm"><b>{lastComment.startsWith("Ответ студента") ? "Последний комментарий:" : "Комментарий деканата:"}</b> {lastComment}</p>}
      {r.status === "NEEDS_INFO" && <AnswerForm id={r.id} />}

      {!offTrack && (
        <ol className="grid grid-cols-4 gap-1" aria-label="Этапы">
          {TRACK.map((s) => {
            const at = reached.get(s);
            return (
              <li key={s} className="text-center">
                <span className={`mx-auto grid size-8 place-items-center rounded-full ${at ? "bg-navy text-white" : "border-2 border-border text-muted-foreground"}`}>{at ? <Check className="size-4" aria-hidden /> : null}</span>
                <span className={`mt-1 block text-xs ${at ? "font-semibold text-navy" : "text-muted-foreground"}`}>{STATUS[s].label}</span>
                {at && <span className="block text-[11px] text-muted-foreground">{fmtDateTime(at)}</span>}
              </li>
            );
          })}
        </ol>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Данные заявки</h2>
        <dl className="divide-y rounded-lg border text-sm">
          {def?.fields.filter((f) => payload[f.name] !== undefined && payload[f.name] !== "").map((f) => (
            <div key={f.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-muted-foreground">{f.label}</dt><dd className="font-medium break-words">{String(payload[f.name])}</dd></div>
          ))}
          {def?.delivery && <div className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-muted-foreground">Как получить</dt><dd className="font-medium">{r.delivery}</dd></div>}
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">История</h2>
        <ol className="space-y-2 border-l-2 border-navy/20 pl-4">
          {r.events.map((e) => (
            <li key={e.id}><b className="text-navy">{STATUS[e.status].label}</b> <span className="text-sm text-muted-foreground">{fmtDateTime(e.createdAt)}</span>{e.comment && <p className="text-sm">{e.comment}</p>}</li>
          ))}
        </ol>
      </section>

      {r.status === "NEW" && (
        <form action={cancelRequest}>
          <input type="hidden" name="id" value={r.id} />
          <Button type="submit" variant="outline" className="h-11 w-full">Отменить заявку</Button>
        </form>
      )}
    </div>
  );
}
