import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { PlanoDetailView } from "@/components/plano-detail-view";
import { filterTasksByListAccess } from "@/lib/authz";
import { todayIso } from "@/lib/dates";
import { podePlanejar } from "@/lib/permissions";
import { requirePageAccess } from "@/lib/page-guard";
import { getPlan, getProject, listMembers, listPlanApprovalResponsesForTasks, listPlanCaptacoes, listPlanEvents, listPlanItemApprovals, listPlanStages, listPlanTasks, listPlans, listStatusColors, listTags, listTasks } from "@/lib/storage";
import { CLOSED_TASK_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlanoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess("planos");
  const { id } = await params;

  const plan = await getPlan(id);
  if (!plan) notFound();
  if (plan.kind === "brand") redirect(`/marcas/${plan.id}`);
  if (user.accessibleProjectIds !== "all" && !user.accessibleProjectIds.includes(plan.projectId)) notFound();

  const [project, captacoes, tasks, members, formatTags, channelTags, categoryTags, statusColors, stages, projectTasks, projectPlans] = await Promise.all([
    getProject(plan.projectId),
    listPlanCaptacoes(plan.id),
    listPlanTasks(plan.id),
    listMembers(),
    listTags("formato"),
    listTags("canal"),
    listTags("categoria"),
    listStatusColors(),
    listPlanStages([{ id: plan.id, projectId: plan.projectId }]),
    listTasks({ projectIds: [plan.projectId], listKinds: user.accessibleListKinds, all: true, projection: "list" }),
    listPlans(plan.projectId),
  ]);
  if (!project) notFound();
  // Candidatas a entrar no plano: abertas, deste cliente e sem plano nenhum.
  const projectPlanIds = new Set(projectPlans.map((item) => item.id));
  const looseTasks = filterTasksByListAccess(projectTasks, user.accessibleListKinds)
    .filter((task) => (!task.planId || !projectPlanIds.has(task.planId)) && !CLOSED_TASK_STATUSES.includes(task.status));
  const [approvals, approvalResponses, planEvents] = await Promise.all([
    listPlanItemApprovals(tasks.map((task) => task.id)),
    listPlanApprovalResponsesForTasks(tasks.map((task) => task.id)),
    listPlanEvents(plan.projectId),
  ]);

  return (
    <AdminShell active="planos" user={user}>
      <PlanoDetailView
        plan={plan}
        project={project}
        initialCaptacoes={captacoes}
        initialTasks={tasks}
        initialApprovals={approvals}
        approvalResponses={approvalResponses}
        captureSuggestions={planEvents.filter((event) => event.eventType.startsWith("captacao:") || event.eventType.startsWith("producao:"))}
        members={members}
        formatTags={formatTags}
        channelTags={channelTags}
        categoryTags={categoryTags}
        statusColors={statusColors}
        currentUserId={user.id}
        stage={stages[plan.id]}
        looseTasks={looseTasks}
        today={todayIso()}
        canEdit={podePlanejar(user.role)}
        canEditTasks
      />
    </AdminShell>
  );
}
