import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { db } from "@/lib/db";
import { REQUEST_TYPES } from "@/lib/requests";
import { RequestForm } from "./request-form";

const FORM = { BACHELOR: "бакалавриат", MASTER: "магистратура", POSTGRAD: "аспирантура" } as const;

export default async function NewRequestPage({ params }: { params: Promise<{ type: string }> }) {
  const user = await requireStudent();
  const { type } = await params;
  const def = REQUEST_TYPES[type];
  if (!def) notFound();
  const debts = def.fields.some((f) => f.optionsFrom === "debts")
    ? (await db.grade.findMany({ where: { enrollmentId: user.enrollment.id, isDebt: true }, select: { discipline: true } })).map((g) => g.discipline)
    : [];
  const fields = def.fields.map((f) => (f.optionsFrom === "debts" ? { ...f, options: debts } : f));
  const e = user.enrollment;
  const profile: [string, string][] = [
    ["ФИО", `${user.lastName} ${user.firstName} ${user.middleName ?? ""}`.trim()],
    ["Уровень, курс", `${FORM[e.level]}, ${e.course} курс`],
    ["Факультет", e.faculty.name],
    ["Группа", e.group?.name ?? "—"],
    ["Форма и основа", `${e.studyForm}, ${e.funding}`],
  ];
  const blocked = type === "retake" && debts.length === 0;
  return (
    <div className="max-w-xl space-y-5">
      <div>
        <Link href="/requests/new" className="text-sm text-brand-blue">← Все типы</Link>
        <h1 className="mt-1 text-2xl font-bold text-navy">{def.label}</h1>
        <p className="text-sm text-muted-foreground">{def.about} Обычно готовим за {def.days} раб. дн.</p>
      </div>
      {blocked ? (
        <p className="rounded-lg border p-4 text-sm">У вас нет академических задолженностей — пересдавать нечего.</p>
      ) : (
        <RequestForm type={type} fields={fields} profile={profile} delivery={def.delivery} />
      )}
    </div>
  );
}
