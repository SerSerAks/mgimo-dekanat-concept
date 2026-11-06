import Link from "next/link";
import type { Prisma, RequestStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestScope } from "@/lib/access";
import { REQUEST_TYPES, requestTypeLabel, STATUS } from "@/lib/requests";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/time";

const TABS: [string, string, RequestStatus[]][] = [
  ["open", "К работе", ["NEW", "IN_PROGRESS", "NEEDS_INFO"]],
  ["NEW", "Новые", ["NEW"]],
  ["IN_PROGRESS", "В работе", ["IN_PROGRESS"]],
  ["NEEDS_INFO", "Ждут студента", ["NEEDS_INFO"]],
  ["READY", "Готовы к выдаче", ["READY"]],
  ["closed", "Закрытые", ["ISSUED", "REJECTED", "CANCELLED"]],
];

export default async function StaffRequests({ searchParams }: { searchParams: Promise<{ s?: string; type?: string }> }) {
  const user = await requireUser(["DEAN_OFFICE"]);
  const sp = await searchParams;
  const tab = TABS.find(([k]) => k === sp.s) ?? TABS[0];
  const type = sp.type && REQUEST_TYPES[sp.type] ? sp.type : undefined;
  const scope = requestScope(user);
  const where: Prisma.RequestWhereInput = { ...scope, status: { in: tab[2] }, ...(type ? { type } : {}) };
  const [list, counts] = await Promise.all([
    db.request.findMany({
      where, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: { enrollment: { include: { person: { select: { lastName: true, firstName: true } }, group: true } } },
    }),
    db.request.groupBy({ by: ["status"], where: scope, _count: true }),
  ]);
  const count = (st: RequestStatus[]) => counts.filter((c) => st.includes(c.status)).reduce((a, c) => a + c._count, 0);
  const now = new Date();
  const q = (s: string, t?: string) => `/staff/requests?s=${s}${t ? `&type=${t}` : ""}`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Заявки факультета</h1>
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm" aria-label="Статусы">
        {TABS.map(([k, label, st]) => (
          <Link key={k} href={q(k, type)} aria-current={tab[0] === k ? "page" : undefined}
            className={`shrink-0 rounded-sm px-3 py-2.5 ${tab[0] === k ? "bg-navy font-semibold text-white" : "bg-muted"}`}>
            {label} <span className="tabular-nums opacity-70">{count(st)}</span>
          </Link>
        ))}
      </nav>
      <form className="flex gap-2" action="/staff/requests">
        <input type="hidden" name="s" value={tab[0]} />
        <label htmlFor="type" className="sr-only">Тип заявки</label>
        <select id="type" name="type" defaultValue={type ?? ""} className="h-11 flex-1 rounded-sm border px-3 text-sm">
          <option value="">Все типы</option>
          {Object.entries(REQUEST_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
        <button type="submit" className="h-11 rounded-sm border px-4 text-sm font-semibold">Показать</button>
      </form>

      {list.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Здесь пусто — всё обработано.</p> : (
        <ul className="space-y-2">
          {list.map((r) => {
            const overdue = r.dueDate && r.dueDate < now && ["NEW", "IN_PROGRESS"].includes(r.status);
            return (
              <li key={r.id}>
                <Link href={`/staff/requests/${r.id}`} className={`flex items-center justify-between gap-3 rounded-lg border p-4 hover:bg-muted ${overdue ? "border-brand-red/50" : ""}`}>
                  <span className="min-w-0">
                    <b className="block text-navy">{requestTypeLabel(r.type)}</b>
                    <span className="text-sm text-muted-foreground">№{r.number} · {r.enrollment.person.lastName} {r.enrollment.person.firstName} · {r.enrollment.group?.name ?? `${r.enrollment.course} курс`}</span>
                    <span className={`block text-xs ${overdue ? "font-semibold text-brand-red" : "text-muted-foreground"}`}>
                      {fmtDateTime(r.createdAt)}{r.dueDate && ` · срок ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(r.dueDate)}`}{overdue && " · просрочена"}
                    </span>
                  </span>
                  <Badge className={`shrink-0 rounded-sm text-white ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
