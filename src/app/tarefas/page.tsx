import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { TarefasView } from "@/components/tarefas-view";
import { getCurrentUser } from "@/lib/current-user";
import { loadTarefasData } from "@/lib/tarefas-data";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { tasks, projects, members, formatTags, channelTags, statusColors } = await loadTarefasData(user);

  return (
    <AdminShell active="tarefas" user={user}>
      <TarefasView
        initialTasks={tasks}
        initialProjects={projects}
        initialMembers={members}
        initialFormatTags={formatTags}
        initialChannelTags={channelTags}
        initialStatusColors={statusColors}
        canEdit={user.role !== "visualizador"}
        currentUserId={user.id}
      />
    </AdminShell>
  );
}
