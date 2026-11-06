/**
 * Догрузка новых справочных данных в уже заполненную базу БЕЗ очистки:
 * мероприятия МГИМО, периоды практики, сессия, проверки антиплагиата.
 * Идемпотентно: повторный запуск ничего не дублирует. Пароли и заявки не трогает.
 * Запуск: npx tsx scripts/load-extras.ts
 */
import { PrismaClient } from "@prisma/client";
import { appendFileSync, readFileSync } from "node:fs";
import { seedSupervision } from "../prisma/supervision-seed";
import { seedAccounts } from "../prisma/accounts-seed";

const db = new PrismaClient();
const d = (s: string) => new Date(s + "T00:00:00Z");
const DAY = 86400000;

async function main() {
  // мероприятия: upsert по url
  const events = JSON.parse(readFileSync("data/mgimo-events.json", "utf-8")).events as { date: string; time: string | null; place: string | null; title: string; summary: string; url: string }[];
  for (const e of events) {
    const data = { ...e, date: d(e.date) };
    await db.event.upsert({ where: { url: e.url }, create: data, update: data });
  }

  const fac = Object.fromEntries((await db.faculty.findMany()).map((f) => [f.code, f.id]));
  if ((await db.practicePeriod.count()) === 0) {
    const econEn = await db.program.findFirst({ where: { level: "BACHELOR", direction: "Экономика", name: { contains: "International" } } });
    const econ = await db.program.findFirst({ where: { level: "BACHELOR", direction: "Экономика", name: "", facultyLabel: "МЭО" } });
    await db.practicePeriod.createMany({ data: [
      { facultyId: fac["МО"], level: "BACHELOR", course: 1, kind: "Учебная", title: "Ознакомительная практика", startDate: d("2027-06-28"), endDate: d("2027-07-11"), docsDeadline: d("2027-05-20") },
      { facultyId: fac["МО"], level: "BACHELOR", course: 3, kind: "Производственная", title: "Дипломатическая практика (летом после 3 курса)", startDate: d("2027-07-01"), endDate: d("2027-07-28"), docsDeadline: d("2027-05-15") },
      { facultyId: fac["МП"], level: "BACHELOR", course: 3, kind: "Производственная", title: "Правоприменительная практика (февраль 3 курса)", startDate: d("2027-02-01"), endDate: d("2027-02-21"), docsDeadline: d("2026-12-15") },
      { facultyId: fac["МП"], level: "BACHELOR", course: 4, kind: "Преддипломная", title: "Преддипломная практика", startDate: d("2027-03-15"), endDate: d("2027-04-11"), docsDeadline: d("2027-01-31") },
      { facultyId: fac["МЭО"], programId: econ?.id, level: "BACHELOR", course: 3, kind: "Производственная", title: "Практика в банке или компании", startDate: d("2027-06-29"), endDate: d("2027-07-26") },
      { facultyId: fac["МЭО"], programId: econEn?.id, level: "BACHELOR", course: 3, kind: "Производственная", title: "Практика (англоязычная программа) — весенний модуль", startDate: d("2027-04-05"), endDate: d("2027-04-30"), note: "У англоязычной программы свой учебный график" },
      { facultyId: fac["ФУП"], level: "MASTER", course: 2, kind: "Преддипломная", title: "Преддипломная практика магистрантов", startDate: d("2027-02-08"), endDate: d("2027-03-07"), docsDeadline: d("2026-12-20") },
      { facultyId: fac["ФАНК"], level: "POSTGRAD", course: 2, kind: "Педагогическая", title: "Педагогическая практика аспирантов", startDate: d("2027-02-08"), endDate: d("2027-05-31") },
    ] });
  }

  const enr = async (login: string) => db.enrollment.findFirstOrThrow({ where: { status: "ACTIVE", person: { login } } });
  if ((await db.exam.count()) === 0) {
    for (const login of ["student1", "student2", "master1"]) {
      const e = await enr(login);
      if (!e.groupId) continue;
      const current = await db.grade.findMany({ where: { enrollmentId: e.id, mark: null, controlType: { not: "CREDIT" } } });
      let day = 11;
      for (const g of current) {
        await db.exam.create({ data: { groupId: e.groupId, discipline: g.discipline, kind: "Консультация", at: new Date(`2027-01-${String(day - 1).padStart(2, "0")}T12:10:00+03:00`), auditorium: "3141", building: "Корпус МО" } });
        await db.exam.create({ data: { groupId: e.groupId, discipline: g.discipline, kind: g.controlType === "EXAM" ? "Экзамен" : "Зачёт с оценкой", at: new Date(`2027-01-${String(day).padStart(2, "0")}T10:00:00+03:00`), auditorium: "зал 2", building: "Корпус МО" } });
        day += 3;
      }
    }
  }

  if ((await db.antiplagiatCheck.count()) === 0) {
    const s2 = await enr("student2"), m1 = await enr("master1");
    const ago = (n: number) => new Date(Date.now() - n * DAY);
    await db.antiplagiatCheck.createMany({ data: [
      { enrollmentId: s2.id, workTitle: "ВКР: Введение", fileName: "vvedenie_v2.docx", fileSize: 48211, status: "DONE", originality: 87, createdAt: ago(25), checkedAt: ago(25) },
      { enrollmentId: s2.id, workTitle: "ВКР: Глава 1", fileName: "glava1_v1.docx", fileSize: 120554, status: "DONE", originality: 71, createdAt: ago(4), checkedAt: ago(4) },
      { enrollmentId: m1.id, workTitle: "Курсовая работа", fileName: "kursovaya.docx", fileSize: 90112, status: "DONE", originality: 92, createdAt: ago(40), checkedAt: ago(40) },
    ] });
  }

  // выбор научного руководителя (SPEC §12): новые аккаунты дописываются в файл паролей вне git
  const creds = [...(await seedSupervision(db)), ...(await seedAccounts(db))];
  if (creds.length) appendFileSync(process.env.SEED_CREDENTIALS_FILE || ".demo-accounts.local.md", creds.map(([l, p, w]) => `| ${l} | ${p} | ${w} |`).join("\n") + "\n", { mode: 0o600 });

  console.log(`Новых аккаунтов для жюри: ${creds.length}. Готово: мероприятий ${await db.event.count()}, периодов практики ${await db.practicePeriod.count()}, занятий сессии ${await db.exam.count()}, проверок ${await db.antiplagiatCheck.count()}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
