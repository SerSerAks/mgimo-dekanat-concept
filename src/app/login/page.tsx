import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { Disclaimer } from "@/components/disclaimer";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

const DEMO = [
  ["student1", "Бакалавр, 1 курс, МО"],
  ["student2", "Бакалавр, 4 курс, МП (ВКР)"],
  ["student3", "Бакалавр, 3 курс, ФУП — выбирает руководителя"],
  ["master1", "Магистр, 2 курс, ФУП"],
  ["postgrad1", "Аспирант, 2 год"],
  ["dean_mo", "Деканат МО"],
  ["dean_mp", "Деканат МП"],
  ["supervisor1", "Научный руководитель"],
  ["dept_mp", "Кафедра международного права"],
  ["rector1", "Проректор — создаёт деканаты"],
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="space-y-3">
        <Logo />
        <h1 className="text-2xl font-bold text-navy">Вход в кабинет</h1>
      </div>
      <LoginForm />
      <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium text-navy">Тестовые аккаунты для жюри</summary>
        <ul className="mt-2 space-y-1">
          {DEMO.map(([l, d]) => (
            <li key={l}><code className="font-semibold">{l}</code> — {d}</li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">Пароли — в описании конкурсной работы.</p>
      </details>
      <Disclaimer />
    </main>
  );
}
