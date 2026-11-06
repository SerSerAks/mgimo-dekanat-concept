import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Открыть уведомление: отметить прочитанным (только своё) и перейти по ссылке. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { id } = await params;
  const n = await db.notification.findFirst({ where: { id, personId: user.id } });
  if (!n) return NextResponse.redirect(new URL("/notifications", req.url));
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  // только внутренние ссылки — без открытого редиректа на чужие сайты
  const target = n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : "/notifications";
  return NextResponse.redirect(new URL(target, req.url));
}
