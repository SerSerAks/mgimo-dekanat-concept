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
  const { enrollmentScope, requestScope, thesisScope, gradeScope, supervisorRequestScope, canChooseSupervisor } = await import("../src/lib/access");
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
  // правило, а не фиксированный список: студенты могут прикрепляться к руководителю в ходе демо
  const supPerson = await db.person.findUniqueOrThrow({ where: { login: "supervisor1" } });
  const expected = (await db.enrollment.findMany({ where: { supervisorId: supPerson.id, status: "ACTIVE" }, include: { person: true } })).map((e) => e.person.login).sort();
  check("руководитель видит ровно закреплённых за ним студентов", JSON.stringify(supList) === JSON.stringify(expected) && supList.includes("master1") && !supList.includes("student1") && !supList.includes("student2"), supList.join(","));
  const archived = await db.enrollment.count({ where: { supervisorId: supPerson.id, status: { not: "ACTIVE" } } });
  check("руководитель не видит архивные ступени своих бывших студентов", archived > 0 && (await db.enrollment.count({ where: { AND: [enrollmentScope(sup), { status: { not: "ACTIVE" } }] } })) === 0, `архивных закреплений: ${archived}`);
  check("руководитель не видит заявки", (await db.request.count({ where: requestScope(sup) })) === 0);

  const dept = await userOf("dept_mp");
  const theses = await db.thesis.findMany({ where: thesisScope(dept), include: { enrollment: { include: { person: true } } } });
  check("кафедра МП видит только ВКР своей кафедры (student2)", theses.length === 1 && theses[0].enrollment.person.login === "student2");
  check("кафедра не видит оценки", (await db.grade.count({ where: gradeScope(dept) })) === 0);

  // выбор научного руководителя (SPEC §12)
  const s3 = await userOf("student3");
  const supReqs = await db.supervisorRequest.findMany({ where: supervisorRequestScope(sup), include: { enrollment: { include: { person: true } } } });
  const supId = (await db.person.findUniqueOrThrow({ where: { login: "supervisor1" } })).id;
  check("руководитель видит только адресованные ему заявки", supReqs.length > 0 && supReqs.every((r) => r.supervisorId === supId), `${supReqs.length} шт.`);
  const foreignReq = await db.supervisorRequest.findFirst({ where: { supervisor: { login: "sup_fup_theory" } } });
  check("руководитель не получает чужую заявку по id", !foreignReq || !(await db.supervisorRequest.findFirst({ where: { id: foreignReq.id, ...supervisorRequestScope(sup) } })));
  check("student3 не видит заявки других студентов", (await db.supervisorRequest.findMany({ where: supervisorRequestScope(s3), include: { enrollment: { include: { person: true } } } })).every((r) => r.enrollment.person.login === "student3"));
  check("деканат не видит заявки на руководство", (await db.supervisorRequest.count({ where: supervisorRequestScope(deanMo) })) === 0);
  const s3e = await db.enrollment.findFirstOrThrow({ where: { person: { login: "student3" }, status: "ACTIVE" } });
  const s1e = await db.enrollment.findFirstOrThrow({ where: { person: { login: "student1" }, status: "ACTIVE" } });
  check("выбирать руководителя может 3 курс без руководителя, но не 1 курс", canChooseSupervisor(s3e) === !s3e.supervisorId && !canChooseSupervisor(s1e));

  console.log(failed ? `\nПровалено проверок: ${failed}` : "\nВсе проверки доступа пройдены");
  await db.$disconnect();
  process.exit(failed ? 1 : 0);
})();
