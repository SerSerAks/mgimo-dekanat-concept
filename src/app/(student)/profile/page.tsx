import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";

const LEVEL = { BACHELOR: "Бакалавриат", MASTER: "Магистратура", POSTGRAD: "Аспирантура" } as const;

export default async function ProfilePage() {
  const user = await requireStudent();
  const e = await db.enrollment.findFirstOrThrow({
    where: { id: user.enrollment.id, personId: user.id },
    include: { faculty: true, program: true, group: true, supervisor: { select: { lastName: true, firstName: true, middleName: true } } },
  });
  const rows: [string, string | null | undefined][] = [
    ["Уровень", LEVEL[e.level]],
    ["Факультет", e.faculty.name],
    ["Направление", e.program?.direction],
    ["Программа", e.program?.name || null],
    ["Курс", String(e.course)],
    ["Группа", e.group?.name],
    ["Языковая подгруппа", e.languageSubgroup],
    ["Форма обучения", `${e.studyForm}, ${e.funding}`],
    ["Студенческий билет", e.studentCardNo],
    ["Научный руководитель", e.supervisor ? `${e.supervisor.lastName} ${e.supervisor.firstName} ${e.supervisor.middleName ?? ""}` : null],
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">{user.lastName} {user.firstName} {user.middleName}</h1>
      <dl className="divide-y rounded-lg border">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[200px_1fr]">
            <dt className="text-sm text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
