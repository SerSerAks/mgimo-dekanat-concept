import { requireStudent } from "@/lib/auth";
import { NotificationsView } from "@/components/notifications-view";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ unread?: string }> }) {
  const user = await requireStudent();
  return <NotificationsView personId={user.id} base="/notifications" onlyUnread={(await searchParams).unread === "1"} />;
}
