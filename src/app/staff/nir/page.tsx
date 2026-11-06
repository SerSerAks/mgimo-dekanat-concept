import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignScope } from "@/lib/access";
import { ACADEMIC_YEAR } from "@/lib/campaigns";
import { deleteNirCampaign } from "@/app/actions/supervision";
import { NirForm } from "../plan/plan-forms";
import { CampaignList, loadCampaigns } from "../plan/campaign-list";

/** Кафедра: НИР на учебный год — кому выбрать руководителя и до какого срока. Руководители — только этой кафедры. */
export default async function DepartmentNir() {
  const user = await requireUser(["DEPARTMENT"]);
  const dep = await db.department.findUniqueOrThrow({ where: { id: user.staffDepartmentId ?? -1 } });
  const [rows, programs] = await Promise.all([
    loadCampaigns(campaignScope(user)),
    db.program.findMany({ where: { OR: [{ facultyId: dep.facultyId, level: { in: ["BACHELOR", "MASTER"] } }, { level: "POSTGRAD" }] }, orderBy: [{ level: "asc" }, { direction: "asc" }] }),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">НИР {ACADEMIC_YEAR}</h1>
        <p className="text-sm text-muted-foreground">{dep.name}. Загрузите НИР — преподаватели кафедры получат напоминание открыть приём, студенты — выбрать руководителя среди преподавателей кафедры. Сервер сам напоминает тем, кто не успел.</p>
      </div>
      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-semibold text-navy">Загрузить НИР</h2>
        <NirForm programs={programs.map((p) => ({ id: p.id, level: p.level, label: `${p.specialtyCode ? p.specialtyCode + " " : ""}${p.direction}${p.name ? ` — ${p.name}` : ""}` }))} />
      </section>
      {rows.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">НИР на {ACADEMIC_YEAR} пока не загружена.</p> : (
        <CampaignList rows={rows} canEdit={() => true} extra={(c) => c._count.requests === 0 && (
          <form action={deleteNirCampaign} className="mt-2"><input type="hidden" name="id" value={c.id} /><button type="submit" className="h-11 rounded-sm border border-brand-red/40 px-3 text-sm text-brand-red">Удалить — заявок пока нет</button></form>
        )} />
      )}
    </div>
  );
}
