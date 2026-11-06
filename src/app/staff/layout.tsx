import { requireUser } from "@/lib/auth";
import { unreadCount } from "@/lib/notifications";
import { AppShell } from "@/components/app-shell";
import { STAFF_NAV as NAV } from "./nav-items";
import { RoleSwitcher } from "@/components/role-switcher";

const ROLE = { RECTOR: "Проректор", DEAN_OFFICE: "Деканат", SUPERVISOR: "Преподаватель", DEPARTMENT: "Кафедра" } as const;

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["RECTOR", "DEAN_OFFICE", "SUPERVISOR", "DEPARTMENT"]);
  const unread = await unreadCount(user.id);
  const role = user.role as keyof typeof ROLE;
  // на телефоне не больше 5 пунктов: 4 первых + «Ещё»
  const items = NAV[role];
  const mobile = items.length > 5 ? [...items.slice(0, 4), { href: "/staff/more", label: "Ещё", icon: "menu" as const }] : items;
  return (
    <AppShell notificationsHref="/staff/notifications" items={items} mobileItems={mobile} unread={unread} userLabel={`${ROLE[role]} · ${user.firstName} ${user.lastName}`}
      roleSwitch={user.roles.length > 1 ? <RoleSwitcher roles={user.roles} activeId={user.activeAppointmentId} /> : undefined}>
      {children}
    </AppShell>
  );
}
