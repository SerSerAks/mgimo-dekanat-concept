import "server-only";
import { db } from "./db";

/** Типовые должности деканата — стартовый список факультета; дальше его правит декан (SPEC §15). */
export const DEFAULT_POSITIONS = [
  "Заместитель декана по учебной работе", "Заместитель декана по работе со студентами", "Заместитель декана по магистратуре",
  "Начальник 1 курса", "Начальник 2 курса", "Начальник 3 курса", "Начальник 4 курса",
  "Руководитель магистерской программы", "Специалист по учебной работе", "Методист", "Секретарь деканата",
];

/** Должности деканата факультета по порядку. Пустой справочник заполняется типовыми должностями. */
export async function facultyPositions(facultyId: number) {
  let list = await db.facultyPosition.findMany({ where: { facultyId }, orderBy: [{ sort: "asc" }, { id: "asc" }] });
  if (list.length === 0) {
    await db.facultyPosition.createMany({ data: DEFAULT_POSITIONS.map((name, i) => ({ facultyId, name, sort: i })), skipDuplicates: true });
    list = await db.facultyPosition.findMany({ where: { facultyId }, orderBy: [{ sort: "asc" }, { id: "asc" }] });
  }
  return list;
}
