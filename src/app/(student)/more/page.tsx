import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const LINKS = [
  ["/dekanat", "Мой деканат"],
  ["/profile", "Профиль"],
  ["/notifications", "Уведомления"],
  ["/antiplagiat", "Антиплагиат"],
  ["/supervisor", "Научный руководитель"],
];

export default async function MorePage() {
  await requireStudent();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Ещё</h1>
      <ul className="divide-y rounded-lg border">
        {LINKS.map(([href, label]) => (
          <li key={href}><Link href={href} className="flex min-h-12 items-center px-4 hover:bg-muted">{label}</Link></li>
        ))}
      </ul>
      <form action={logout}><Button type="submit" variant="outline" className="h-11 w-full">Выйти</Button></form>
    </div>
  );
}
