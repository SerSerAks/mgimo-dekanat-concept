import { requireUser } from "@/lib/auth";
import { NotificationsView } from "@/components/notifications-view";
import { ROLE_LABEL } from "@/components/role-switcher";
import { rolesForPath } from "../nav-items";

export default async function StaffNotificationsPage({ searchParams }: { searchParams: Promise<{ unread?: string }> }) {
  const user = await requireUser(["RECTOR", "DEAN_OFFICE", "SUPERVISOR", "DEPARTMENT"]);
  // у совместителя уведомления общие — помечаем, к какой должности относится каждое (SPEC §17)
  const mine = new Set(user.roles.map((r) => r.role as string));
  const tagFor = user.roles.length > 1 ? (link: string | null) => {
    const r = rolesForPath(link).find((x) => mine.has(x));
    return r ? ROLE_LABEL[r as keyof typeof ROLE_LABEL] : null;
  } : undefined;
  return <NotificationsView personId={user.id} base="/staff/notifications" onlyUnread={(await searchParams).unread === "1"} tagFor={tagFor} />;
}
