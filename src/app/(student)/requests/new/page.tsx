import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireStudent } from "@/lib/auth";
import { REQUEST_GROUPS, REQUEST_TYPES } from "@/lib/requests";

export default async function NewRequestCatalog() {
  await requireStudent();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/requests" className="text-sm text-brand-blue">← Мои заявки</Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">Новая заявка</h1>
        <p className="text-sm text-muted-foreground">Данные из профиля подставятся сами. Срок — в рабочих днях.</p>
      </div>
      {REQUEST_GROUPS.map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</h2>
          <ul className="divide-y rounded-lg border">
            {Object.entries(REQUEST_TYPES).filter(([, t]) => t.group === g).map(([key, t]) => (
              <li key={key}>
                <Link href={`/requests/new/${key}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
                  <span>
                    <b className="block text-navy">{t.label}</b>
                    <span className="text-sm text-muted-foreground">{t.about} · {t.days} раб. дн.</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
