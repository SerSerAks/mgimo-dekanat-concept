import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { PrintButton } from "./print-button";

export default async function AntiplagiatReport({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const { id } = await params;
  const c = await db.antiplagiatCheck.findFirst({
    where: { id, status: "DONE", enrollment: { personId: user.id } }, // чужая справка = 404
    include: { enrollment: { include: { faculty: true, group: true } } },
  });
  if (!c) notFound();
  const fmt = (d: Date) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "long", timeStyle: "short" }).format(d);
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/antiplagiat" className="text-sm text-brand-blue">← Антиплагиат</Link>
        <PrintButton />
      </div>
      <article className="relative overflow-hidden rounded-lg border p-6 print:border-0">
        <span aria-hidden className="pointer-events-none absolute inset-0 grid -rotate-12 place-items-center text-7xl font-bold text-navy/5">ОБРАЗЕЦ</span>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Справка о результатах проверки на заимствования</p>
        <h1 className="mt-1 text-xl font-bold text-navy">{c.workTitle}</h1>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
          <dt className="text-muted-foreground">Автор</dt><dd>{user.lastName} {user.firstName} {user.middleName}</dd>
          <dt className="text-muted-foreground">Факультет, группа</dt><dd>{c.enrollment.faculty.name}, {c.enrollment.group?.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Файл</dt><dd>{c.fileName} ({Math.round(c.fileSize / 1024)} КБ)</dd>
          <dt className="text-muted-foreground">Дата проверки</dt><dd>{c.checkedAt && fmt(c.checkedAt)}</dd>
          <dt className="text-muted-foreground">Оригинальность</dt><dd className="text-2xl font-bold text-navy">{c.originality}%</dd>
          <dt className="text-muted-foreground">Заимствования</dt><dd>{100 - c.originality!}%</dd>
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">Документ сформирован в концепте «Цифровой деканат» для конкурса. Не является официальной справкой системы «Антиплагиат» и МГИМО.</p>
      </article>
    </div>
  );
}
