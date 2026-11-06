// Допустимые переходы статуса заявки (SPEC §6.1) и тексты уведомлений студенту.
import type { RequestStatus } from "@prisma/client";

export type Transition = { to: RequestStatus; label: string; needs?: "comment" | "pickup"; tone?: "primary" | "danger" | "outline" };

export const DEAN_TRANSITIONS: Partial<Record<RequestStatus, Transition[]>> = {
  NEW: [
    { to: "IN_PROGRESS", label: "Взять в работу", tone: "primary" },
    { to: "REJECTED", label: "Отклонить", needs: "comment", tone: "danger" },
  ],
  IN_PROGRESS: [
    { to: "READY", label: "Готово", needs: "pickup", tone: "primary" },
    { to: "NEEDS_INFO", label: "Нужны уточнения", needs: "comment", tone: "outline" },
    { to: "REJECTED", label: "Отклонить", needs: "comment", tone: "danger" },
  ],
  NEEDS_INFO: [{ to: "IN_PROGRESS", label: "Вернуть в работу", tone: "outline" }],
  READY: [{ to: "ISSUED", label: "Отметить выданной", tone: "primary" }],
};

export function notificationFor(to: RequestStatus, number: number, label: string, extra?: string | null) {
  switch (to) {
    case "IN_PROGRESS": return { title: `Заявку №${number} взяли в работу`, body: `${label}: деканат готовит документ.` };
    case "READY": return { title: `${label} готова`, body: extra ? `Заберите: ${extra}.` : "Документ готов." };
    case "NEEDS_INFO": return { title: `По заявке №${number} есть вопрос`, body: extra ?? "Деканату нужно уточнение." };
    case "REJECTED": return { title: `Заявку №${number} отклонили`, body: extra ?? "Подробности в карточке заявки." };
    case "ISSUED": return { title: `${label} выдана`, body: "Спасибо! Заявка закрыта." };
    default: return { title: `Заявка №${number}: статус изменён`, body: label };
  }
}
