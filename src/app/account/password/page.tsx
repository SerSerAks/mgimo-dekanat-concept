import { requireUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Disclaimer } from "@/components/disclaimer";
import { PasswordForm } from "./password-form";

export default async function ChangePasswordPage() {
  const user = await requireUser(undefined, { allowPasswordChange: true });
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <div>
        <h1 className="text-2xl font-bold text-navy">{user.mustChangePassword ? "Придумайте свой пароль" : "Смена пароля"}</h1>
        <p className="text-sm text-muted-foreground">
          {user.mustChangePassword ? "Пароль, который вам выдали, одноразовый. Задайте свой — его будете знать только вы." : `Логин: ${user.login}`}
        </p>
      </div>
      <PasswordForm />
      <Disclaimer />
    </main>
  );
}
