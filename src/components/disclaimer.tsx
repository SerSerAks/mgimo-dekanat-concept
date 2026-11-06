export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      Концепт для конкурса «Цифровой деканат будущего». Не официальный сервис МГИМО. Все данные студентов и преподавателей вымышлены.
    </p>
  );
}
