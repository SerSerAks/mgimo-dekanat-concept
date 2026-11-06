/**
 * Проверка правил доступа на тестовых данных (npm run test:access).
 * Строит «текущего пользователя» так же, как приложение, и считает, что видит каждая роль.
 */
import { PrismaClient } from "@prisma/client";
// access.ts помечен server-only; для скрипта подменяем модуль
import Module from "node:module";
const origResolve = (Module as unknown as { _resolveFilename: (req: string, ...a: unknown[]) => unknown })._resolveFilename;
(Module as unknown as { _resolveFilename: (req: string, ...a: unknown[]) => unknown })._resolveFilename = function (req: string, ...rest: unknown[]) {
  return req === "server-only" ? require.resolve("./noop.cjs") : origResolve.call(this, req, ...rest);
};

const db = new PrismaClient();
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`); if (!ok) failed++; };

async function userOf(login: string) {
  const p = await db.person.findUniqueOrThrow({ where: { login }, include: { enrollments: { where: { status: "ACTIVE" }, take: 1 } } });
  const { enrollments, ...rest } = p;
  return { ...rest, enrollment: enrollments[0] ?? null } as never;
}

(async () => {
  const { enrollmentScope, requestScope, thesisScope, gradeScope } = await import("../src/lib/access");
  const names = async (where: object) => (await db.enrollment.findMany({ where, include: { person: true } })).map((e) => e.person.login).sort();

  const s1 = await userOf("student1");
  const s1req = await db.request.findMany({ where: requestScope(s1), include: { enrollment: { include: { person: true } } } });
  check("student1 видит только свои заявки", s1req.length > 0 && s1req.every((r) => r.enrollment.person.login === "student1"), `${s1req.length} шт.`);
  const s2req = await db.request.findFirstOrThrow({ where: { enrollment: { person: { login: "student2" } } } });
  check("student1 не получает заявку student2 по id", !(await db.request.findFirst({ where: { id: s2req.id, ...requestScope(s1) } })));
  const s1grades = await db.grade.findMany({ where: gradeScope(s1), include: { enrollment: { include: { person: true } } } });
  check("student1 видит только свои оценки", s1grades.every((g) => g.enrollment.person.login === "student1"));

  const m1 = await userOf("master1");
  const m1enr = await db.enrollment.findMany({ where: enrollmentScope(m1) });
  check("master1 видит обе свои ступени (архив + текущую)", m1enr.length === 2, `${m1enr.length}`);

  const deanMo = await userOf("dean_mo");
  const moList = await names(enrollmentScope(deanMo));
  check("деканат МО не видит студентов МП и ФУП", !moList.includes("student2") && !moList.includes("master1"), moList.join(","));
  const deanMp = await userOf("dean_mp");
  const mpReq = await db.request.findMany({ where: requestScope(deanMp), include: { enrollment: { include: { faculty: true } } } });
  check("деканат МП видит заявки только МП", mpReq.length > 0 && mpReq.every((r) => r.enrollment.faculty.code === "МП"), `${mpReq.length} шт.`);

  const sup = await userOf("supervisor1");
  const supList = await names(enrollmentScope(sup));
  check("руководитель видит только закреплённых (master1, postgrad1)", JSON.stringify(supList) === JSON.stringify(["master1", "postgrad1"]), supList.join(","));
  check("руководитель не видит архивную магистратуру postgrad1", (await db.enrollment.count({ where: enrollmentScope(sup) })) === 2);
  check("руководитель не видит заявки", (await db.request.count({ where: requestScope(sup) })) === 0);

  const dept = await userOf("dept_mp");
  const theses = await db.thesis.findMany({ where: thesisScope(dept), include: { enrollment: { include: { person: true } } } });
  check("кафедра МП видит только ВКР своей кафедры (student2)", theses.length === 1 && theses[0].enrollment.person.login === "student2");
  check("кафедра не видит оценки", (await db.grade.count({ where: gradeScope(dept) })) === 0);

  console.log(failed ? `\nПровалено проверок: ${failed}` : "\nВсе проверки доступа пройдены");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
})();
