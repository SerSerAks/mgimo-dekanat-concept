import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { STAFF_NAV as NAV } from "../nav-items";

export default async function StaffMore() {
  const user = await requireUser(["RECTOR", "DEAN_OFFICE", "SUPERVISOR", "DEPARTMENT"]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Ещё</h1>
      <ul className="divide-y rounded-lg border">
        {[...NAV[user.role], { href: "/staff/notifications", label: "Уведомления" }, { href: "/account/password", label: "Сменить пароль" }].map((i) => (
          <li key={i.href}><Link href={i.href} className="flex min-h-12 items-center px-4 hover:bg-muted">{i.label}</Link></li>
        ))}
      </ul>
      <form action={logout}><button type="submit" className="h-11 w-full rounded-sm border text-sm font-semibold">Выйти</button></form>
    </div>
  );
}
