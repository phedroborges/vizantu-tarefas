import { AdminShell } from "@/components/admin-shell";
import { TarefasView } from "@/components/tarefas-view";
import { listMembers, listProjects, listTags, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const [tasks, projects, members, formatTags, channelTags] = await Promise.all([
    listTasks(),
    listProjects(),
    listMembers(),
    listTags("formato"),
    listTags("canal"),
  ]);

  return (
    <AdminShell active="tarefas">
      <TarefasView
        initialTasks={tasks}
        initialProjects={projects}
        initialMembers={members}
        initialFormatTags={formatTags}
        initialChannelTags={channelTags}
      />
    </AdminShell>
  );
}
