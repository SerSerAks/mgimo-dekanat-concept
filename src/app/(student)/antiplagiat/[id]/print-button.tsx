"use client";
import { Printer } from "lucide-react";
export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-1.5 rounded-sm bg-navy px-4 text-sm font-semibold text-white"><Printer className="size-4" aria-hidden />Скачать PDF</button>;
}
