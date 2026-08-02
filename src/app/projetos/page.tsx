import { AdminShell } from "@/components/admin-shell";
import { ProjetosView } from "@/components/projetos-view";
import { listProjects, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProjetosPage() {
  const [projects, tasks] = await Promise.all([listProjects(), listTasks()]);

  return (
    <AdminShell active="projetos">
      <ProjetosView initialProjects={projects} initialTasks={tasks} />
    </AdminShell>
  );
}
