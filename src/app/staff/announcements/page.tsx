import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { AnnouncementForm } from "./announcement-form";

export default async function StaffAnnouncements() {
  const user = await requireUser(["DEAN_OFFICE", "SUPERVISOR", "DEPARTMENT"]);
  const [mine, groups] = await Promise.all([
    db.announcement.findMany({ where: { authorId: user.id }, orderBy: { publishedAt: "desc" }, take: 20, include: { group: true } }),
    user.role === "DEAN_OFFICE" && user.staffFacultyId != null ? db.group.findMany({ where: { facultyId: user.staffFacultyId }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const scopeText = user.role === "DEAN_OFFICE" ? "студентам вашего факультета" : user.role === "SUPERVISOR" ? "вашим студентам" : "выпускникам кафедры";
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Объявления</h1>
        <p className="text-sm text-muted-foreground">Объявление уйдёт {scopeText} уведомлением в кабинет.</p>
      </div>
      <AnnouncementForm groups={groups.map((g) => ({ id: g.id, name: g.name }))} canNarrow={user.role === "DEAN_OFFICE"} />
      <section>
        <h2 className="mb-2 font-semibold text-navy">Опубликованные</h2>
        {mine.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Вы ещё ничего не публиковали.</p> : (
          <ul className="space-y-2">
            {mine.map((a) => (
              <li key={a.id} className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">{fmtDateTime(a.publishedAt)} · {a.group ? `группа ${a.group.name}` : a.course ? `${a.course} курс` : "все"}{a.important && " · важное"}</p>
                <b className="text-navy">{a.title}</b>
                <p className="whitespace-pre-line text-sm">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
