import { requireUser } from "@/lib/auth";
import { campaignScope } from "@/lib/access";
import { ACADEMIC_YEAR } from "@/lib/campaigns";
import { LoadPlanButton } from "./plan-forms";
import { CampaignList, loadCampaigns } from "./campaign-list";

export default async function StaffPlan() {
  const user = await requireUser(["DEAN_OFFICE"]);
  const rows = await loadCampaigns(campaignScope(user));
  const own = rows.filter((r) => r.c.departmentId == null);
  const nir = rows.filter((r) => r.c.departmentId != null);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy">Учебный план {ACADEMIC_YEAR}: научное руководство</h1>
        <p className="text-sm text-muted-foreground">Деканат загружает курсовые и выпускные работы. После загрузки руководители получают напоминание открыть приём, а студенты — выбрать руководителя. Дальше сервер сам напоминает тем, кто не успел.</p>
      </div>
      <LoadPlanButton loaded={own.length > 0} />
      {own.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">План на {ACADEMIC_YEAR} ещё не загружен.</p> : <CampaignList rows={own} canEdit={() => true} />}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-navy">НИР кафедр факультета</h2>
          <p className="text-sm text-muted-foreground">НИР загружают кафедры сами — здесь видно, как идёт выбор руководителей. Сроки меняет кафедра.</p>
        </div>
        {nir.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Кафедры пока не загрузили НИР.</p> : <CampaignList rows={nir} canEdit={() => false} />}
      </section>
    </div>
  );
}
