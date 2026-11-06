// ДОПУЩЕНИЕ: точная шкала МГИМО («Шкала соответствия оценок: пятибалльных — рейтинговых — ECTS») не прочитана —
// PDF отдаётся только на скачивание (docs/research/mgimo-open-data.md §4). Заменить значения после ручной проверки.
export const SCALE = [
  { min: 90, mark: "5", ects: "A" },
  { min: 82, mark: "4", ects: "B" },
  { min: 75, mark: "4", ects: "C" },
  { min: 67, mark: "3", ects: "D" },
  { min: 60, mark: "3", ects: "E" },
  { min: 0, mark: "2", ects: "F" },
] as const;

export const PASS_THRESHOLD = 60;

export function toMark(score: number) {
  return SCALE.find((s) => score >= s.min)!;
}
