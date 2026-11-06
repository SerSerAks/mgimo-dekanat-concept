// Временный собственный знак (не логотип МГИМО). Финальный — на этапе дизайна.
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold text-navy">
      <span aria-hidden className="grid size-8 place-items-center rounded-sm bg-navy text-sm text-white">ЦД</span>
      {!compact && <span className="leading-tight">Цифровой<br className="hidden sm:block" /> деканат</span>}
    </span>
  );
}
