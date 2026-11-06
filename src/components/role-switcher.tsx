import { ArrowLeftRight, Check } from "lucide-react";
import { switchRoleAction } from "@/app/actions/auth";
import type { StaffRole } from "@/lib/auth";

export const ROLE_LABEL = { RECTOR: "Проректор", DEAN_OFFICE: "Деканат", SUPERVISOR: "Преподаватель", DEPARTMENT: "Кафедра", STUDENT: "Студент" } as const;

export const roleTitle = (r: StaffRole) => `${r.position ?? ROLE_LABEL[r.role]}${r.unit ? ` · ${r.unit}` : ""}`;

/**
 * Переключатель должностей (SPEC §17): одна учётка — несколько должностей.
 * Работает без JavaScript: <details> + формы. Права после переключения — только выбранной должности.
 */
export function RoleSwitcher({ roles, activeId }: { roles: StaffRole[]; activeId: string | null }) {
  const active = roles.find((r) => r.id === activeId) ?? roles[0];
  return (
    <details className="relative">
      <summary className="flex h-11 max-w-[11rem] cursor-pointer list-none items-center gap-1.5 rounded-sm border px-2 text-sm sm:max-w-xs" aria-label={`Должность: ${roleTitle(active)}. Сменить`}>
        <ArrowLeftRight className="size-4 shrink-0 text-navy" aria-hidden />
        <span className="truncate font-semibold text-navy">{active.role === "DEAN_OFFICE" ? "Деканат" : ROLE_LABEL[active.role]}</span>
      </summary>
      <div className="fixed inset-x-4 top-14 z-40 rounded-lg border bg-background p-1 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-1 sm:w-80">
        <p className="px-3 py-2 text-xs text-muted-foreground">Вы работаете в нескольких должностях. Права — только выбранной.</p>
        {roles.map((r) => {
          const on = r.id === active.id;
          return (
            <form key={r.id ?? "primary"} action={switchRoleAction}>
              <input type="hidden" name="appointmentId" value={r.id ?? "primary"} />
              <button type="submit" disabled={on} aria-current={on ? "true" : undefined} className={`flex min-h-11 w-full items-start gap-2 rounded-sm px-3 py-2 text-left text-sm ${on ? "bg-secondary font-semibold" : "hover:bg-muted"}`}>
                <Check className={`mt-0.5 size-4 shrink-0 ${on ? "text-navy" : "invisible"}`} aria-hidden />
                <span>{roleTitle(r)}</span>
              </button>
            </form>
          );
        })}
      </div>
    </details>
  );
}
