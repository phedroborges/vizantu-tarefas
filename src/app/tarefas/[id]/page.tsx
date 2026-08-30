import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { TarefasView } from "@/components/tarefas-view";
import { getCurrentUser } from "@/lib/current-user";
import { readMemberPreferences } from "@/lib/storage";
import { loadTarefasData } from "@/lib/tarefas-data";

export const dynamic = "force-dynamic";

export default async function TarefaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/tarefas/${id}`);

  const [{ tasks, projects, members, formatTags, channelTags, statusColors }, storedPreferences] = await Promise.all([
    loadTarefasData(user),
    readMemberPreferences(user.id),
  ]);

  return (
    <AdminShell active="tarefas" user={user}>
      <TarefasView
        initialTasks={tasks}
        initialProjects={projects}
        initialMembers={members}
        initialFormatTags={formatTags}
        initialChannelTags={channelTags}
        initialStatusColors={statusColors}
        initialPreferences={storedPreferences.preferences}
        hasSavedPreferences={storedPreferences.saved}
        canEdit={user.role !== "visualizador"}
        canEditStatusColors={user.role === "dono"}
        currentUserId={user.id}
        initialTaskId={id}
      />
    </AdminShell>
  );
}
