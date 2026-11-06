import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { enrollmentScope } from "@/lib/access";

const LEVEL = { BACHELOR: "бакалавр", MASTER: "магистрант", POSTGRAD: "аспирант" } as const;

export default async function SupervisorStudents() {
  const user = await requireUser(["SUPERVISOR"]);
  const list = await db.enrollment.findMany({
    where: enrollmentScope(user),
    include: { person: { select: { lastName: true, firstName: true } }, group: true, thesis: true },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy">Мои студенты</h1>
      {list.length === 0 && <p className="text-sm">За вами пока не закреплены студенты.</p>}
      <ul className="space-y-2">
        {list.map((e) => (
          <li key={e.id} className="rounded-lg border p-4">
            <b className="text-navy">{e.person.lastName} {e.person.firstName}</b> · {LEVEL[e.level]} · {e.group?.name ?? `${e.course} год`}
            {e.thesis?.topic && <p className="text-sm text-muted-foreground">Тема: {e.thesis.topic} · этап {e.thesis.stage} из 10</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
