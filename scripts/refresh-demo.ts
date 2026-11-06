// Ежедневно (cron на сервере): пересчитать вымышленные изменения расписания относительно сегодняшней даты.
import { PrismaClient } from "@prisma/client";
import { applyDemoChanges, resetDemoChanges } from "../prisma/demo-changes";

const db = new PrismaClient();
const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date()) + "T00:00:00Z");
(async () => {
  await resetDemoChanges(db);
  await applyDemoChanges(db, today);
  console.log("Демо-изменения пересчитаны на", today.toISOString().slice(0, 10));
  await db.$disconnect();
})();
