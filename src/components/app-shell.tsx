import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Logo } from "./logo";
import { Disclaimer } from "./disclaimer";
import { BottomNav, SideNav, type NavItem } from "./nav";

export function AppShell({ items, mobileItems, unread, userLabel, aside, roleSwitch, notificationsHref = "/notifications", children }: {
  items: NavItem[]; mobileItems?: NavItem[]; unread: number; userLabel: string; aside?: React.ReactNode; roleSwitch?: React.ReactNode; notificationsHref?: string; children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="На главную"><Logo compact /></Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted-foreground lg:inline">{userLabel}</span>
            {roleSwitch}
            <Link href={notificationsHref} className="relative grid size-11 place-items-center rounded-sm hover:bg-muted" aria-label={`Уведомления: ${unread} непрочитанных`}>
              <Bell className="size-5 text-navy" aria-hidden />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <form action={logout}>
              <button type="submit" className="grid size-11 place-items-center rounded-sm hover:bg-muted" aria-label="Выйти" title="Выйти">
                <LogOut className="size-5 text-navy" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-24 pt-4 md:grid-cols-[260px_1fr] md:pb-10">
        <aside className="md:sticky md:top-20 md:max-h-[calc(100dvh-6rem)] md:self-start md:overflow-y-auto">
          <SideNav items={items} />
          {aside && <div className="mt-6 hidden md:block">{aside}</div>}
        </aside>
        <main className="min-w-0">
          {children}
          <Disclaimer className="mt-10" />
        </main>
      </div>
      <BottomNav items={mobileItems ?? items} />
    </div>
  );
}
