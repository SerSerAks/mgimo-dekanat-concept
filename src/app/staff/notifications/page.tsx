import { requireUser } from "@/lib/auth";
import { NotificationsView } from "@/components/notifications-view";

export default async function StaffNotificationsPage({ searchParams }: { searchParams: Promise<{ unread?: string }> }) {
  const user = await requireUser(["RECTOR", "DEAN_OFFICE", "SUPERVISOR", "DEPARTMENT"]);
  return <NotificationsView personId={user.id} base="/staff/notifications" onlyUnread={(await searchParams).unread === "1"} />;
}
