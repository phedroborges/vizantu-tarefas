import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ProjetosView } from "@/components/projetos-view";
import { getCurrentUser } from "@/lib/current-user";
import { listProjects, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProjetosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [projects, tasks] = await Promise.all([listProjects(), listTasks()]);
  const visibleProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const visibleTasks = user.accessibleProjectIds === "all" ? tasks : tasks.filter((t) => user.accessibleProjectIds.includes(t.projectId));

  return (
    <AdminShell active="projetos" user={user}>
      <ProjetosView initialProjects={visibleProjects} initialTasks={visibleTasks} canEdit={user.role !== "visualizador"} />
    </AdminShell>
  );
}
