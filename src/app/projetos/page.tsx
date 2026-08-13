import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ProjetosView } from "@/components/projetos-view";
import { filterTasksByAccess, filterTasksByListAccess } from "@/lib/authz";
import { getCurrentUser } from "@/lib/current-user";
import { listProjects, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProjetosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [projects, tasks] = await Promise.all([listProjects(), listTasks()]);
  const visibleProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const visibleTasks = filterTasksByListAccess(filterTasksByAccess(tasks, user.accessibleProjectIds), user.accessibleListKinds);

  return (
    <AdminShell active="projetos" user={user}>
      <ProjetosView initialProjects={visibleProjects} initialTasks={visibleTasks} canEdit={user.role !== "visualizador"} />
    </AdminShell>
  );
}
