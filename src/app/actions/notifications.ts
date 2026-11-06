"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function markAllRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { personId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}
