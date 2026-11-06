// Ежедневно (cron на сервере, 00:05 МСК): пересчитать вымышленные изменения расписания относительно сегодняшней даты
// и разослать напоминания по кампаниям выбора руководителя (SPEC §13).
import { PrismaClient } from "@prisma/client";
import { applyDemoChanges, resetDemoChanges } from "../prisma/demo-changes";
import { runReminders } from "../src/lib/campaigns";

const db = new PrismaClient();
const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date()) + "T00:00:00Z");
(async () => {
  await resetDemoChanges(db);
  await applyDemoChanges(db, today);
  const reminders = await runReminders(db, today);
  console.log("Демо-изменения пересчитаны на", today.toISOString().slice(0, 10), "· напоминаний отправлено:", reminders);
  await db.$disconnect();
})();
