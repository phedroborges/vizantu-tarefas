import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { PlanoDetailView } from "@/components/plano-detail-view";
import { getCurrentUser } from "@/lib/current-user";
import { getPlan, getProject, listMembers, listPlanCaptacoes, listPlanClients, listPlanTasks, listStatusColors, listTags } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function PlanoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const plan = await getPlan(id);
  if (!plan) notFound();
  if (user.accessibleProjectIds !== "all" && !user.accessibleProjectIds.includes(plan.projectId)) notFound();

  const [project, captacoes, tasks, members, formatTags, channelTags, categoryTags, statusColors, clients] = await Promise.all([
    getProject(plan.projectId),
    listPlanCaptacoes(plan.id),
    listPlanTasks(plan.id),
    listMembers(),
    listTags("formato"),
    listTags("canal"),
    listTags("categoria"),
    listStatusColors(),
    listPlanClients(plan.projectId),
  ]);
  if (!project) notFound();

  return (
    <AdminShell active="planos" user={user}>
      <PlanoDetailView
        plan={plan}
        project={project}
        initialCaptacoes={captacoes}
        initialTasks={tasks}
        members={members}
        formatTags={formatTags}
        channelTags={channelTags}
        categoryTags={categoryTags}
        statusColors={statusColors}
        initialClients={clients}
        currentUserId={user.id}
        canEdit={user.role !== "visualizador"}
      />
    </AdminShell>
  );
}
