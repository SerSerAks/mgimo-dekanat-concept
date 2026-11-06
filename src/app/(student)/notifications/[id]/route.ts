import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, switchRole } from "@/lib/auth";
import { rolesForPath } from "@/app/staff/nav-items";

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
  // совместитель (SPEC §17): уведомление другой должности — сначала переключаемся на неё, иначе страница не откроется
  const need = rolesForPath(target);
  if (user.roles.length > 1 && need.length && !need.includes(user.role)) {
    const other = user.roles.find((r) => need.includes(r.role));
    if (other) await switchRole(other.id);
  }
  return NextResponse.redirect(new URL(target, req.url));
}
