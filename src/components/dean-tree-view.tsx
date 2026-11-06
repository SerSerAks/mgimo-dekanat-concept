import { Clock, DoorOpen, Phone } from "lucide-react";
import type { TreeNode } from "@/lib/dean-tree";

/** Дерево деканата: карточки с отступом и линией к руководителю. Работает с 360 px. */
export function DeanTreeView({ nodes, depth = 0, action }: { nodes: TreeNode[]; depth?: number; action?: (n: TreeNode) => React.ReactNode }) {
  return (
    <ul className={depth ? "mt-2 space-y-2 border-l-2 border-navy/15 pl-3 sm:pl-5" : "space-y-3"}>
      {nodes.map((n) => (
        <li key={n.id}>
          <article className={`rounded-lg border p-3 ${depth === 0 ? "border-navy/40 bg-secondary/60" : ""}`}>
            {n.position && <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{n.position}</p>}
            <b className="text-navy">{n.fio}</b>
            {n.duties && <p className="text-sm">{n.duties}</p>}
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {n.room && <span className="inline-flex items-center gap-1"><DoorOpen className="size-3.5" aria-hidden />{n.room}</span>}
              {n.hours && <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{n.hours}</span>}
              {n.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" aria-hidden />{n.phone}</span>}
            </p>
            {n.login && <p className="mt-1 text-xs"><code className="rounded-sm bg-muted px-1">{n.login}</code>{n.mustChange && <span className="ml-2 font-semibold text-status-warn">ещё не входил</span>}</p>}
            {action?.(n)}
          </article>
          {n.children.length > 0 && <DeanTreeView nodes={n.children} depth={depth + 1} action={action} />}
        </li>
      ))}
    </ul>
  );
}
