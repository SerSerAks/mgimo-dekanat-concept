import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { thesisScope } from "@/lib/access";

export default async function DepartmentGraduates() {
  const user = await requireUser(["DEPARTMENT"]);
  const list = await db.thesis.findMany({
    where: thesisScope(user),
    include: { enrollment: { include: { person: { select: { lastName: true, firstName: true } }, group: true, supervisor: { select: { lastName: true } } } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Выпускники кафедры</h1>
      {list.length === 0 && <p className="text-sm">Выпускников пока нет.</p>}
      <ul className="space-y-2">
        {list.map((t) => (
          <li key={t.id} className="rounded-lg border p-4">
            <b className="text-navy">{t.enrollment.person.lastName} {t.enrollment.person.firstName}</b> · {t.enrollment.group?.name}
            <p className="text-sm">{t.topic ?? "Тема не выбрана"} · этап {t.stage} из 10{t.enrollment.supervisor ? ` · руководитель ${t.enrollment.supervisor.lastName}` : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
