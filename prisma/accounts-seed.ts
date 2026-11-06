/**
 * Иерархия аккаунтов (SPEC §14): проректор для жюри, кафедра у аспиранта, авторы уже созданных аккаунтов.
 * Идемпотентно. Возвращает новые учётные данные для файла вне git.
 */
import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/password";

export async function seedAccounts(db: PrismaClient): Promise<[string, string, string][]> {
  const creds: [string, string, string][] = [];
  let rector = await db.person.findUnique({ where: { login: "rector1" } });
  if (!rector) {
    const password = process.env.DEMO_PASSWORD_RECTOR1 || randomBytes(9).toString("base64url");
    rector = await db.person.create({ data: { login: "rector1", role: "RECTOR", passwordHash: await hashPassword(password), lastName: "Карпова", firstName: "Мария", middleName: "Олеговна" } });
    creds.push(["rector1", password, "Проректор: создаёт деканаты"]);
  }
  // деканаты созданы проректором, кафедры и студенты — деканатом своего факультета
  await db.person.updateMany({ where: { role: "DEAN_OFFICE", createdById: null }, data: { createdById: rector.id } });
  for (const dean of await db.person.findMany({ where: { role: "DEAN_OFFICE" } })) {
    await db.person.updateMany({ where: { role: "DEPARTMENT", createdById: null, staffDepartment: { facultyId: dean.staffFacultyId ?? -1 } }, data: { createdById: dean.id } });
    await db.person.updateMany({ where: { role: "STUDENT", createdById: null, enrollments: { some: { facultyId: dean.staffFacultyId ?? -1, level: { in: ["BACHELOR", "MASTER"] } } } }, data: { createdById: dean.id } });
  }
  // аспирант postgrad1 — на кафедре государственного управления (кафедра его руководителя)
  const gov = await db.department.findFirst({ where: { name: "Кафедра государственного управления" } });
  if (gov) await db.enrollment.updateMany({ where: { level: "POSTGRAD", departmentId: null, person: { login: "postgrad1" } }, data: { departmentId: gov.id } });
  return creds;
}
