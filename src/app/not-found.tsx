import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-navy">Страница не найдена</h1>
      <p className="mt-2 text-sm text-muted-foreground">Возможно, ссылка устарела или у вас нет к ней доступа.</p>
      <Link href="/" className="mt-6 inline-block rounded-sm bg-navy px-4 py-3 text-sm font-semibold text-white">На главную</Link>
    </main>
  );
}
