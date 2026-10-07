import { AdminShell } from "@/components/admin-shell";
import { BroadcastsView } from "@/components/broadcasts-view";
import { requirePageAccess } from "@/lib/page-guard";
import { listProjects } from "@/lib/storage";
import { whatsappConfigured } from "@/lib/whatsapp/provider";
import { getAutomationSettings, listProjectCommunications } from "@/lib/whatsapp/queue";
import { countPendingMessages, listBroadcasts } from "@/lib/whatsapp/service";

export const dynamic = "force-dynamic";

export default async function ComunicadosPage() {
  const user = await requirePageAccess("comunicados");
  const [projects, communications, broadcasts, automation, pending] = await Promise.all([listProjects(), listProjectCommunications(), listBroadcasts(), getAutomationSettings(), countPendingMessages()]);
  const groupByProject = new Map(communications.map((item) => [item.projectId, item.whatsappGroupId ? item.whatsappGroupName || item.whatsappGroupId : undefined]));

  return (
    <AdminShell active="comunicados" user={user}>
      <BroadcastsView
        clients={projects.filter((project) => project.status === "ativo").map((project) => ({ id: project.id, name: project.client || project.name, groupName: groupByProject.get(project.id) }))}
        configured={whatsappConfigured()}
        initialBroadcasts={broadcasts}
        initialAutomation={automation}
        initialPending={pending}
      />
    </AdminShell>
  );
}
