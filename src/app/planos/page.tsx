import { AdminShell } from "@/components/admin-shell";
import { PlanosView } from "@/components/planos-view";
import { filterTasksByAccess, filterTasksByListAccess } from "@/lib/authz";
import { todayIso } from "@/lib/dates";
import { podePlanejar } from "@/lib/permissions";
import { requirePageAccess } from "@/lib/page-guard";
import { listMembers, listPlanCaptacoes, listPlanStages, listPlans, listProjects, listStatusColors, listTags, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function PlanosPage({ searchParams }: { searchParams: Promise<{ cliente?: string | string[] }> }) {
  const user = await requirePageAccess("planos");
  const params = await searchParams;

  const [plans, projects, allTasks, members, formatTags, channelTags, categoryTags, statusColors] = await Promise.all([
    listPlans(), listProjects(),
    listTasks({ projectIds: user.accessibleProjectIds, listKinds: user.accessibleListKinds, all: true, projection: "list" }),
    listMembers(), listTags("formato"), listTags("canal"), listTags("categoria"), listStatusColors(),
  ]);
  const canSee = (projectId: string) => user.accessibleProjectIds === "all" || user.accessibleProjectIds.includes(projectId);
  const visibleProjects = projects.filter((project) => canSee(project.id));
  const visiblePlans = plans.filter((plan) => plan.kind !== "brand" && canSee(plan.projectId));
  // Entregável de marca tem a sua própria tela (Marcas) e não entra na fila.
  const brandPlanIds = new Set(plans.filter((plan) => plan.kind === "brand").map((plan) => plan.id));
  const tasks = filterTasksByListAccess(filterTasksByAccess(allTasks, user.accessibleProjectIds), user.accessibleListKinds)
    .filter((task) => !task.planId || !brandPlanIds.has(task.planId));

  const requested = Array.isArray(params.cliente) ? params.cliente[0] : params.cliente;
  const selected = visibleProjects.find((project) => project.id === requested);
  // Etapa e pacotes só importam com um cliente aberto: sem isso, a tela de
  // escolha não paga por consultas que não mostra.
  const clientPlans = selected ? visiblePlans.filter((plan) => plan.projectId === selected.id) : [];
  const [planStages, captacoes] = await Promise.all([
    listPlanStages(clientPlans.map((plan) => ({ id: plan.id, projectId: plan.projectId }))),
    Promise.all(clientPlans.filter((plan) => plan.kind === "content").map((plan) => listPlanCaptacoes(plan.id))).then((groups) => groups.flat()),
  ]);

  return (
    <AdminShell active="planos" user={user}>
      <PlanosView
        key={selected?.id ?? "clientes"}
        projects={visibleProjects}
        initialPlans={visiblePlans}
        initialTasks={tasks}
        selectedProjectId={selected?.id}
        planStages={planStages}
        captacoes={captacoes}
        members={members}
        formatTags={formatTags}
        channelTags={channelTags}
        categoryTags={categoryTags}
        statusColors={statusColors}
        currentUserId={user.id}
        currentUserRole={user.role}
        canPlan={podePlanejar(user.role)}
        today={todayIso()}
      />
    </AdminShell>
  );
}
