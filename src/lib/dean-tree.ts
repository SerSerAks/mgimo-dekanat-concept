import "server-only";
import { db } from "./db";

export type TreeNode = {
  id: string; fio: string; position: string | null; duties: string | null; room: string | null; hours: string | null; phone: string | null;
  login?: string; mustChange?: boolean; children: TreeNode[];
};

/**
 * Дерево деканата факультета (SPEC §15). Корень — декан (isHead) и все, у кого руководитель не найден.
 * withLogin — только для сотрудников; студентам служебные поля не отдаются.
 */
export async function deanTree(facultyId: number, withLogin = false): Promise<TreeNode[]> {
  const staff = await db.person.findMany({
    where: { role: "DEAN_OFFICE", staffFacultyId: facultyId },
    select: { id: true, login: true, lastName: true, firstName: true, middleName: true, position: true, isHead: true, managerId: true, staffDuties: true, staffRoom: true, staffHours: true, workPhone: true, mustChangePassword: true, createdAt: true },
    orderBy: [{ isHead: "desc" }, { createdAt: "asc" }],
  });
  const nodes = new Map<string, TreeNode>(staff.map((p) => [p.id, {
    id: p.id, fio: `${p.lastName} ${p.firstName}${p.middleName ? " " + p.middleName : ""}`, position: p.position,
    duties: p.staffDuties, room: p.staffRoom, hours: p.staffHours, phone: p.workPhone,
    ...(withLogin ? { login: p.login, mustChange: p.mustChangePassword } : {}), children: [],
  }]));
  const roots: TreeNode[] = [];
  for (const p of staff) {
    const parent = p.managerId ? nodes.get(p.managerId) : undefined;
    if (parent && !p.isHead) parent.children.push(nodes.get(p.id)!);
    else roots.push(nodes.get(p.id)!);
  }
  return roots;
}
