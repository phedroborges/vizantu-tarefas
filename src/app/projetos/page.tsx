import { AdminShell } from "@/components/admin-shell";
import { ProjetosView } from "@/components/projetos-view";
import { podePlanejar } from "@/lib/permissions";
import { filterTasksByAccess, filterTasksByListAccess } from "@/lib/authz";
import { requirePageAccess } from "@/lib/page-guard";
import { listProjects, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProjetosPage() {
  const user = await requirePageAccess("projetos");

  const [projects, tasks] = await Promise.all([listProjects(), listTasks()]);
  const visibleProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const visibleTasks = filterTasksByListAccess(filterTasksByAccess(tasks, user.accessibleProjectIds), user.accessibleListKinds);

  return (
    <AdminShell active="projetos" user={user}>
      <ProjetosView initialProjects={visibleProjects} initialTasks={visibleTasks} canEdit={podePlanejar(user.role)} />
    </AdminShell>
  );
}
