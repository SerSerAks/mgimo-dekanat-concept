import { requireStudent } from "@/lib/auth";
import { deanTree } from "@/lib/dean-tree";
import { DeanTreeView } from "@/components/dean-tree-view";

/** «Мой деканат»: кто в деканате факультета и за что отвечает (SPEC §15). Без логинов и служебных полей. */
export default async function MyDeanOffice() {
  const user = await requireStudent();
  const tree = await deanTree(user.enrollment.facultyId);
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Мой деканат</h1>
        <p className="text-sm text-muted-foreground">{user.enrollment.faculty.name} — кто за что отвечает и куда идти.</p>
      </div>
      {tree.length ? <DeanTreeView nodes={tree} /> : <p className="rounded-lg border p-4 text-sm">Деканат ещё не заполнил структуру. Вопросы можно задать через раздел «Заявки».</p>}
    </div>
  );
}
