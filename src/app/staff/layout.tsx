import { requireUser } from "@/lib/auth";
import { unreadCount } from "@/lib/notifications";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav";

const NAV: Record<string, NavItem[]> = {
  DEAN_OFFICE: [
    { href: "/staff/requests", label: "Заявки", icon: "inbox" },
    { href: "/staff/announcements", label: "Объявления", icon: "megaphone" },
    { href: "/staff/practice", label: "Практика", icon: "calendar" },
    { href: "/staff/people", label: "Студенты", icon: "users" },
  ],
  SUPERVISOR: [
    { href: "/staff/students", label: "Мои студенты", icon: "users" },
    { href: "/staff/announcements", label: "Объявления", icon: "megaphone" },
  ],
  DEPARTMENT: [
    { href: "/staff/graduates", label: "Выпускники", icon: "users" },
  ],
};
const ROLE = { DEAN_OFFICE: "Деканат", SUPERVISOR: "Научный руководитель", DEPARTMENT: "Кафедра" } as const;

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["DEAN_OFFICE", "SUPERVISOR", "DEPARTMENT"]);
  const unread = await unreadCount(user.id);
  const role = user.role as keyof typeof ROLE;
  return (
    <AppShell items={NAV[role]} unread={unread} userLabel={`${ROLE[role]} · ${user.firstName} ${user.lastName}`}>
      {children}
    </AppShell>
  );
}
