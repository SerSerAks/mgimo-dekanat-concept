// Типы заявок — docs/content/requests.md (ДОПУЩЕНИЕ: перечень МГИМО не опубликован, сроки условные).
export type Field = {
  name: string; label: string; kind: "text" | "textarea" | "select" | "number";
  options?: string[]; optionsFrom?: "debts"; required?: boolean; max?: number; hint?: string; min?: number;
};
export type RequestType = { label: string; group: string; days: number; about: string; fields: Field[]; delivery: boolean };

const place: Field = { name: "place", label: "Куда предоставить", kind: "text", required: true, max: 120, hint: "Например: по месту работы родителей, в банк" };
const copies: Field = { name: "copies", label: "Количество экземпляров", kind: "number", required: true, min: 1, max: 5 };

export const REQUEST_TYPES: Record<string, RequestType> = {
  study_cert: { label: "Справка об обучении", group: "Справки", days: 2, delivery: true, about: "Подтверждает, что вы студент МГИМО: курс, форма и срок обучения.", fields: [place, copies] },
  order_extract: { label: "Выписка из приказа", group: "Справки", days: 3, delivery: true, about: "Копия пункта приказа, который касается вас.", fields: [
    { name: "order", label: "Какой приказ", kind: "select", required: true, options: ["О зачислении", "О переводе на следующий курс", "О назначении стипендии", "О предоставлении академического отпуска", "О смене фамилии", "Другой"] },
    { name: "orderOther", label: "Если «Другой» — какой именно", kind: "text", max: 120 },
    place, copies] },
  military_cert: { label: "Справка для военкомата", group: "Справки", days: 3, delivery: true, about: "Для отсрочки от призыва.", fields: [{ name: "office", label: "Военный комиссариат", kind: "text", required: true, max: 120 }, copies] },
  social_cert: { label: "Справка для соцзащиты / СФР", group: "Справки", days: 3, delivery: true, about: "Для пособий и пенсии по потере кормильца.", fields: [place, copies] },
  visa_cert: { label: "Справка для визы (на английском)", group: "Справки", days: 5, delivery: true, about: "Для консульства, на английском языке.", fields: [
    { name: "country", label: "Страна", kind: "text", required: true, max: 60 }, { name: "dates", label: "Даты поездки", kind: "text", required: true, max: 60 }] },
  scholarship_cert: { label: "Справка о размере стипендии", group: "Справки", days: 3, delivery: true, about: "Сумма стипендии за выбранные месяцы.", fields: [{ name: "period", label: "За какой период", kind: "text", required: true, max: 60, hint: "Например: сентябрь–ноябрь 2026" }] },
  session_call: { label: "Справка-вызов на сессию", group: "Справки", days: 3, delivery: true, about: "Для работодателя: учебный отпуск на сессию.", fields: [{ name: "employer", label: "Место работы", kind: "text", required: true, max: 120 }] },
  academic_cert: { label: "Академическая справка", group: "Справки", days: 10, delivery: true, about: "Перечень освоенных дисциплин — при переводе или отчислении.", fields: [{ name: "reason", label: "Для чего", kind: "select", required: true, options: ["Перевод в другой вуз", "Отчисление", "Другое"] }] },
  retake: { label: "Запись на пересдачу", group: "Заявления", days: 3, delivery: false, about: "Выберите долг — деканат назначит дату пересдачи.", fields: [{ name: "discipline", label: "Дисциплина", kind: "select", required: true, optionsFrom: "debts" }] },
  individual_schedule: { label: "Индивидуальный график", group: "Заявления", days: 10, delivery: false, about: "Свободное посещение при работе, спорте, болезни.", fields: [
    { name: "reason", label: "Причина", kind: "textarea", required: true, max: 500 }, { name: "period", label: "Период", kind: "text", required: true, max: 60 }] },
  academic_leave: { label: "Академический отпуск", group: "Заявления", days: 10, delivery: false, about: "Перерыв в учёбе по медицинским или семейным обстоятельствам.", fields: [
    { name: "basis", label: "Основание", kind: "select", required: true, options: ["Медицинские показания", "Семейные обстоятельства", "Другое"] }, { name: "period", label: "Период", kind: "text", required: true, max: 60 }] },
  financial_aid: { label: "Материальная помощь", group: "Заявления", days: 10, delivery: false, about: "Единовременная выплата в трудной ситуации.", fields: [{ name: "basis", label: "Основание", kind: "textarea", required: true, max: 500 }] },
  practice_referral: { label: "Направление на практику", group: "Практика", days: 3, delivery: true, about: "Письмо в организацию, где вы будете проходить практику.", fields: [
    { name: "org", label: "Организация", kind: "text", required: true, max: 120 }, { name: "address", label: "Адрес организации", kind: "text", required: true, max: 160 }] },
  practice_place: { label: "Согласование места практики", group: "Практика", days: 5, delivery: false, about: "Кафедра проверит, подходит ли организация под программу практики.", fields: [
    { name: "org", label: "Организация", kind: "text", required: true, max: 120 }, { name: "position", label: "Подразделение / должность", kind: "text", max: 120 }, { name: "contact", label: "Руководитель практики от организации", kind: "text", max: 120, hint: "ФИО и телефон — реальные данные в прототип не вводите" }] },
};
export const requestTypeLabel = (t: string) => REQUEST_TYPES[t]?.label ?? t;
export const REQUEST_GROUPS = ["Справки", "Заявления", "Практика"] as const;

export const STATUS: Record<string, { label: string; cls: string }> = {
  NEW: { label: "Новая", cls: "bg-status-new" },
  IN_PROGRESS: { label: "В работе", cls: "bg-status-progress" },
  NEEDS_INFO: { label: "Нужны уточнения", cls: "bg-status-warn" },
  READY: { label: "Готова", cls: "bg-status-ok" },
  ISSUED: { label: "Выдана", cls: "bg-status-new" },
  REJECTED: { label: "Отклонена", cls: "bg-status-bad" },
  CANCELLED: { label: "Отменена", cls: "bg-status-new" },
};

/** Шаги трекера «как у доставки». */
export const TRACK = ["NEW", "IN_PROGRESS", "READY", "ISSUED"] as const;

/** +N рабочих дней (без учёта праздников — ДОПУЩЕНИЕ). */
export function addWorkdays(from: Date, n: number) {
  const d = new Date(from);
  while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n--; }
  return d;
}
