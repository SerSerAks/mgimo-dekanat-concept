import Link from "next/link";
import { ExternalLink, FileCheck2 } from "lucide-react";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { settleChecks, originalityTone } from "@/lib/antiplagiat";
import { fmtDateTime } from "@/lib/time";
import { UploadForm } from "./upload-form";

export default async function AntiplagiatPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const user = await requireStudent();
  await settleChecks(user.enrollment.id);
  const sent = (await searchParams).sent === "1";
  const checks = await db.antiplagiatCheck.findMany({ where: { enrollment: { personId: user.id } }, orderBy: { createdAt: "desc" } });
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Антиплагиат</h1>
        <p className="text-sm text-muted-foreground">Проверка курсовых и выпускных работ на заимствования.</p>
      </div>

      <a href="https://mgimo.antiplagiat.ru" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border p-4 hover:bg-muted">
        <span><b className="block text-navy">Официальная система МГИМО</b><span className="text-sm text-muted-foreground">mgimo.antiplagiat.ru — вход по учётной записи вуза</span></span>
        <ExternalLink className="size-5 shrink-0 text-navy" aria-hidden />
      </a>

      <section aria-labelledby="up">
        <h2 id="up" className="mb-2 font-semibold text-navy">Проверить работу</h2>
        {sent && <p role="status" className="mb-3 rounded-lg border border-status-ok/40 bg-status-ok/5 p-3 text-sm">Работа поставлена в очередь. Результат появится примерно через минуту — обновите страницу.</p>}
        <UploadForm />
        <p className="mt-2 text-xs text-muted-foreground">Концепт: проверка имитируется, сам файл не сохраняется — только его имя и размер. Не загружайте реальные работы с персональными данными.</p>
      </section>

      <section aria-labelledby="list">
        <h2 id="list" className="mb-2 font-semibold text-navy">Мои проверки</h2>
        {checks.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Проверок пока не было.</p> : (
          <ul className="divide-y rounded-lg border">
            {checks.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <b className="block truncate text-navy">{c.workTitle}</b>
                  <span className="text-xs text-muted-foreground">{c.fileName} · {fmtDateTime(c.createdAt)}</span>
                </span>
                {c.status === "DONE" ? (
                  <span className="flex shrink-0 items-center gap-3">
                    <span className={`text-lg font-bold tabular-nums ${originalityTone(c.originality!)}`}>{c.originality}%</span>
                    <Link href={`/antiplagiat/${c.id}`} className="inline-flex h-11 items-center gap-1 rounded-sm border px-3 text-sm font-semibold text-navy"><FileCheck2 className="size-4" aria-hidden />Справка</Link>
                  </span>
                ) : <span className="shrink-0 rounded-sm bg-status-progress px-2 py-1 text-xs font-semibold text-white">Проверяется</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
