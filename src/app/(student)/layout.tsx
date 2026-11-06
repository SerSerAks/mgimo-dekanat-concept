import { requireStudent } from "@/lib/auth";
import { unreadCount } from "@/lib/notifications";
import { AppShell } from "@/components/app-shell";
import { STUDENT_NAV } from "./nav-items";
import { EventsList } from "@/components/events-list";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStudent();
  const unread = await unreadCount(user.id);
  return (
    <AppShell items={STUDENT_NAV} aside={<EventsList limit={4} compact />} unread={unread} userLabel={`${user.firstName} ${user.lastName} · ${user.enrollment.group?.name ?? ""}`}>
      {children}
    </AppShell>
  );
}
