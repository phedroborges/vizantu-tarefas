import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { TarefasView } from "@/components/tarefas-view";
import { getCurrentUser } from "@/lib/current-user";
import { listMembers, listProjects, listTags, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [tasks, projects, members, formatTags, channelTags] = await Promise.all([
    listTasks(),
    listProjects(),
    listMembers(),
    listTags("formato"),
    listTags("canal"),
  ]);

  const visibleProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const visibleTasks = user.accessibleProjectIds === "all" ? tasks : tasks.filter((t) => user.accessibleProjectIds.includes(t.projectId));

  return (
    <AdminShell active="tarefas" user={user}>
      <TarefasView
        initialTasks={visibleTasks}
        initialProjects={visibleProjects}
        initialMembers={members}
        initialFormatTags={formatTags}
        initialChannelTags={channelTags}
        canEdit={user.role !== "visualizador"}
      />
    </AdminShell>
  );
}
