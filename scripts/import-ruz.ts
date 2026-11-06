/**
 * Разовый импорт расписания из открытого API РУЗ МГИМО (ruz.mgimo.ru) в снимок data/ruz-snapshot.json.
 * Запуск вручную: npm run import:ruz
 *
 * Правила (docs/SPEC.md §8, CLAUDE.md):
 *  - берём ТОЛЬКО поля из белого списка FIELDS; всё о преподавателях (ФИО, должность, e-mail, id) отбрасывается;
 *  - кабинет в рантайме к РУЗ не обращается — только seed читает этот снимок.
 */
import { writeFileSync } from "node:fs";

const GROUPS = [
  { name: "1МО-01", ruzId: 7814 },
  { name: "4МП-02", ruzId: 7592 },
  { name: "2МагГУ-01", ruzId: 8226 },
  { name: "3УП-01", ruzId: 8203 },
];
const FROM = new Date("2026-09-01");
const TO = new Date("2026-12-31");

type RuzLesson = Record<string, unknown>;
const FIELDS = ["date", "beginLesson", "endLesson", "discipline", "kindOfWork", "auditorium", "building", "subGroup"] as const;

const fmt = (d: Date) => d.toISOString().slice(0, 10).replaceAll("-", ".");

async function fetchRange(ruzId: number, from: Date, to: Date): Promise<RuzLesson[]> {
  const url = `https://ruz.mgimo.ru/api/schedule/group/${ruzId}?start=${fmt(from)}&finish=${fmt(to)}&lng=1`;
  const res = await fetch(url, { headers: { "User-Agent": "dekanat-concept-import/1.0 (contest prototype)" } });
  if (!res.ok) throw new Error(`РУЗ ответил ${res.status} для группы ${ruzId}`);
  return res.json();
}

async function main() {
  const out: Record<string, { ruzId: number; lessons: Record<string, string | null>[] }> = {};
  for (const g of GROUPS) {
    const lessons: Record<string, string | null>[] = [];
    // по месяцам, с паузой — бережём сервер вуза
    for (let d = new Date(FROM); d <= TO; d.setMonth(d.getMonth() + 1)) {
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const chunk = await fetchRange(g.ruzId, d, end < TO ? end : TO);
      for (const l of chunk) {
        lessons.push(Object.fromEntries(FIELDS.map((f) => [f, (l[f] as string | null) ?? null])));
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    out[g.name] = { ruzId: g.ruzId, lessons };
    console.log(`${g.name}: ${lessons.length} занятий`);
  }
  const snapshot = {
    source: "https://ruz.mgimo.ru (открытые данные). Поля преподавателей удалены при импорте.",
    importedAt: new Date().toISOString(),
    period: { from: FROM.toISOString().slice(0, 10), to: TO.toISOString().slice(0, 10) },
    groups: out,
  };
  writeFileSync("data/ruz-snapshot.json", JSON.stringify(snapshot, null, 1));
  console.log("Сохранено в data/ruz-snapshot.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
