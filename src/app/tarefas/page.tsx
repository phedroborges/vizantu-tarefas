import { AdminShell } from "@/components/admin-shell";
import { TarefasView } from "@/components/tarefas-view";
import { listProjects, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);

  return (
    <AdminShell active="tarefas">
      <TarefasView initialTasks={tasks} initialProjects={projects} />
    </AdminShell>
  );
}
