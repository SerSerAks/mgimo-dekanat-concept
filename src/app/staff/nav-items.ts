import type { NavItem } from "@/components/nav";

// Меню сотрудников по ролям (порядок важен: на телефоне видны первые 4 + «Ещё»).
export const STAFF_NAV: Record<string, NavItem[]> = {
  RECTOR: [
    { href: "/staff/accounts", label: "Деканы", icon: "users" },
  ],
  DEAN_OFFICE: [
    { href: "/staff/requests", label: "Заявки", icon: "inbox" },
    { href: "/staff/people", label: "Студенты", icon: "users" },
    { href: "/staff/accounts", label: "Аккаунты", icon: "check" },
    { href: "/staff/plan", label: "Учебный план", icon: "book" },
    { href: "/staff/announcements", label: "Объявления", icon: "megaphone" },
    { href: "/staff/practice", label: "Практика", icon: "calendar" },
  ],
  SUPERVISOR: [
    { href: "/staff/supervision", label: "Заявки студентов", icon: "inbox" },
    { href: "/staff/students", label: "Мои студенты", icon: "users" },
    { href: "/staff/announcements", label: "Объявления", icon: "megaphone" },
  ],
  DEPARTMENT: [
    { href: "/staff/graduates", label: "Выпускники", icon: "users" },
    { href: "/staff/nir", label: "НИР", icon: "book" },
    { href: "/staff/accounts", label: "Аккаунты", icon: "check" },
  ],
};

/** Каким должностям принадлежит страница — по меню. Нужно совместителям (SPEC §17): пометка уведомления и автопереключение. */
export function rolesForPath(path: string | null): string[] {
  if (!path) return [];
  const clean = path.split("?")[0];
  return Object.entries(STAFF_NAV).filter(([, items]) => items.some((i) => clean === i.href || clean.startsWith(i.href + "/"))).map(([role]) => role);
}
