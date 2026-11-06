import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestScope } from "@/lib/access";
import { requestTypeLabel, STATUS } from "@/lib/requests";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/time";

const ACTIVE = ["NEW", "IN_PROGRESS", "NEEDS_INFO", "READY"] as const;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const user = await requireStudent();
  const all = (await searchParams).all === "1";
  const list = await db.request.findMany({
    where: { ...requestScope(user), ...(all ? {} : { status: { in: [...ACTIVE] } }) },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy">Мои заявки</h1>
        <Link href="/requests/new" className="inline-flex h-11 items-center gap-1.5 rounded-sm bg-navy px-4 text-sm font-semibold text-white"><Plus className="size-4" aria-hidden />Новая</Link>
      </div>
      <nav className="flex gap-1 text-sm" aria-label="Фильтр">
        <Link href="/requests" aria-current={!all ? "page" : undefined} className={`rounded-sm px-3 py-2 ${!all ? "bg-secondary font-semibold text-navy" : "text-muted-foreground"}`}>Активные</Link>
        <Link href="/requests?all=1" aria-current={all ? "page" : undefined} className={`rounded-sm px-3 py-2 ${all ? "bg-secondary font-semibold text-navy" : "text-muted-foreground"}`}>Все</Link>
      </nav>
      {list.length === 0 ? (
        <div className="rounded-lg border p-5 text-sm">
          <p>{all ? "Заявок пока нет." : "Активных заявок нет."} Самое частое — справка об обучении: оформляется за минуту.</p>
          <Link href="/requests/new/study_cert" className="mt-3 inline-block font-semibold text-brand-blue">Заказать справку об обучении →</Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-4 hover:bg-muted">
                <span className="min-w-0">
                  <b className="block text-navy">{requestTypeLabel(r.type)}</b>
                  <span className="text-sm text-muted-foreground">№{r.number} · {fmtDateTime(r.createdAt)}</span>
                </span>
                <Badge className={`shrink-0 rounded-sm text-white ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
