"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, GraduationCap, Home, Menu, Users, Inbox, Megaphone, BookOpen, ClipboardCheck, type LucideIcon } from "lucide-react";

// Иконки передаются строкой: серверный компонент не может передать функцию в клиентский.
const ICONS = { home: Home, calendar: CalendarDays, study: GraduationCap, file: FileText, menu: Menu, users: Users, inbox: Inbox, megaphone: Megaphone, book: BookOpen, check: ClipboardCheck } satisfies Record<string, LucideIcon>;
export type IconName = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: IconName };

function active(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

/** Нижняя панель на телефоне (< md). */
export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          const on = active(path, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-navy" : "text-muted-foreground"}`}>
                <Icon className="size-5" strokeWidth={on ? 2.4 : 1.8} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Боковое меню на компьютере (≥ md). */
export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Основная навигация" className="hidden md:block">
      <ul className="space-y-1">
        {items.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          const on = active(path, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={on ? "page" : undefined}
                className={`flex h-11 items-center gap-3 rounded-sm px-3 text-sm font-medium ${on ? "bg-secondary text-navy" : "text-foreground hover:bg-muted"}`}>
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
