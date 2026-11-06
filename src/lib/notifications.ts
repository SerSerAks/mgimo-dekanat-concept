import "server-only";
import { db } from "./db";

export function unreadCount(personId: string) {
  return db.notification.count({ where: { personId, readAt: null } });
}
