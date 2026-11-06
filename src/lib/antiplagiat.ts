import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";

const DELAY_MS = 60_000;

/** Имитация проверки: через минуту после загрузки проверка «завершается» с детерминированным процентом 62–96. */
export async function settleChecks(enrollmentId: string) {
  const due = await db.antiplagiatCheck.findMany({ where: { enrollmentId, status: "QUEUED", createdAt: { lt: new Date(Date.now() - DELAY_MS) } } });
  for (const c of due) {
    const h = createHash("sha256").update(c.id).digest()[0];
    await db.antiplagiatCheck.update({ where: { id: c.id }, data: { status: "DONE", originality: 62 + (h % 35), checkedAt: new Date(c.createdAt.getTime() + DELAY_MS) } });
  }
}

export const originalityTone = (p: number) => (p >= 75 ? "text-status-ok" : p >= 60 ? "text-status-warn" : "text-brand-red");
