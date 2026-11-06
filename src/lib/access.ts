import "server-only";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./auth";

/**
 * Единая точка правил доступа (docs/SPEC.md, раздел 2).
 * Каждая функция возвращает Prisma-условие «что этому пользователю видно».
 * Любой запрос объекта по id обязан объединять id с этим условием:
 *   db.request.findFirst({ where: { id, ...requestScope(user) } })  → null → notFound()
 * Так чужой объект неотличим от несуществующего (404), даже если подставить id в адрес.
 */

const NOTHING = { id: "__none__" } as const;

/** Ступени обучения, которые видит пользователь. */
export function enrollmentScope(user: CurrentUser): Prisma.EnrollmentWhereInput {
  switch (user.role) {
    case "STUDENT":
      return { personId: user.id };
    case "DEAN_OFFICE":
      // только свой факультет и только текущие ступени
      return user.staffFacultyId != null
        ? { facultyId: user.staffFacultyId, status: { in: ["ACTIVE", "TRANSFERRING"] } }
        : NOTHING;
    case "SUPERVISOR":
      return { supervisorId: user.id, status: "ACTIVE" };
    case "DEPARTMENT":
      return user.staffDepartmentId != null
        ? { status: "ACTIVE", thesis: { departmentId: user.staffDepartmentId } }
        : NOTHING;
  }
}

/** Заявки: студент — свои, деканат — своего факультета. Руководитель и кафедра заявок не видят. */
export function requestScope(user: CurrentUser): Prisma.RequestWhereInput {
  if (user.role === "STUDENT") return { enrollment: { personId: user.id } };
  if (user.role === "DEAN_OFFICE") return { enrollment: enrollmentScope(user) };
  return { id: "__none__" };
}

/** ВКР / диссертации. */
export function thesisScope(user: CurrentUser): Prisma.ThesisWhereInput {
  switch (user.role) {
    case "STUDENT":
      return { enrollment: { personId: user.id } };
    case "DEAN_OFFICE":
      return { enrollment: enrollmentScope(user) };
    case "SUPERVISOR":
      return { enrollment: { supervisorId: user.id, status: "ACTIVE" } };
    case "DEPARTMENT":
      return user.staffDepartmentId != null ? { departmentId: user.staffDepartmentId, enrollment: { status: "ACTIVE" } } : { id: "__none__" };
  }
}

/** Оценки: студент — свои (все ступени), деканат — своего факультета. */
export function gradeScope(user: CurrentUser): Prisma.GradeWhereInput {
  if (user.role === "STUDENT") return { enrollment: { personId: user.id } };
  if (user.role === "DEAN_OFFICE") return { enrollment: enrollmentScope(user) };
  return { id: -1 };
}

/** Что сотрудник может делать с заявками. */
export const can = {
  changeRequestStatus: (user: CurrentUser) => user.role === "DEAN_OFFICE",
  cancelRequest: (user: CurrentUser) => user.role === "STUDENT",
  commentThesis: (user: CurrentUser) => user.role === "SUPERVISOR" || user.role === "STUDENT",
  approveTopic: (user: CurrentUser) => user.role === "DEPARTMENT",
  setAdmission: (user: CurrentUser) => user.role === "DEPARTMENT",
  moveLesson: (user: CurrentUser) => user.role === "DEAN_OFFICE",
  publishAnnouncement: (user: CurrentUser) => user.role !== "STUDENT",
};

/** Заявки на научное руководство: студент — свои, руководитель — адресованные ему. */
export function supervisorRequestScope(user: CurrentUser): Prisma.SupervisorRequestWhereInput {
  if (user.role === "STUDENT") return { enrollment: { personId: user.id } };
  if (user.role === "SUPERVISOR") return { supervisorId: user.id };
  return { id: "__none__" };
}

/** Кто выбирает руководителя сам: бакалавр с 3 курса, магистрант, аспирант — без закреплённого руководителя. */
export function canChooseSupervisor(e: { level: "BACHELOR" | "MASTER" | "POSTGRAD"; course: number; supervisorId: string | null; status?: string }) {
  if (e.supervisorId) return false;
  if (e.status && e.status !== "ACTIVE") return false;
  return e.level !== "BACHELOR" || e.course >= 3;
}
