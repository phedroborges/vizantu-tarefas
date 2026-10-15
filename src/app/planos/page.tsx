import { AdminShell } from "@/components/admin-shell";
import { PlanosView } from "@/components/planos-view";
import { filterTasksByAccess, filterTasksByListAccess } from "@/lib/authz";
import { todayIso } from "@/lib/dates";
import { podePlanejar } from "@/lib/permissions";
import { requirePageAccess } from "@/lib/page-guard";
import { ensureMonthlyPlans, listPlans, listProjects, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function PlanosPage({ searchParams }: { searchParams: Promise<{ cliente?: string | string[] }> }) {
  const user = await requirePageAccess("planos");
  const params = await searchParams;

  const projects = await listProjects();
  await ensureMonthlyPlans(projects.filter(p => p.status === "ativo" && (user.accessibleProjectIds === "all" || user.accessibleProjectIds.includes(p.id))).map(p => p.id));
  const [plans, allTasks] = await Promise.all([
    listPlans(),
    listTasks({ projectIds: user.accessibleProjectIds, listKinds: user.accessibleListKinds, all: true, projection: "list", includeArchivedPlans: true }),
  ]);
  const canSee = (projectId: string) => user.accessibleProjectIds === "all" || user.accessibleProjectIds.includes(projectId);
  const visibleProjects = projects.filter((project) => canSee(project.id));
  const visiblePlans = plans.filter((plan) => plan.kind !== "brand" && canSee(plan.projectId));
  // Entregável de marca tem a sua própria tela (Marcas) e não entra na fila.
  const brandPlanIds = new Set(plans.filter((plan) => plan.kind === "brand").map((plan) => plan.id));
  const tasks = filterTasksByListAccess(filterTasksByAccess(allTasks, user.accessibleProjectIds), user.accessibleListKinds)
    .filter((task) => (!task.planId || !brandPlanIds.has(task.planId)) && (user.role !== "diretor_criativo" || task.assigneeId === user.id));

  const requested = Array.isArray(params.cliente) ? params.cliente[0] : params.cliente;
  const selected = visibleProjects.find((project) => project.id === requested);

  return (
    <AdminShell active="planos" user={user}>
      <PlanosView
        key={(selected?.id ?? "clientes") + ":" + todayIso()}
        projects={visibleProjects}
        initialPlans={visiblePlans}
        initialTasks={tasks}
        selectedProjectId={selected?.id}
        currentUserId={user.id}
        currentUserRole={user.role}
        canPlan={podePlanejar(user.role)}
        today={todayIso()}
      />
    </AdminShell>
  );
}
