import { AdminShell } from "@/components/admin-shell";
import { PlanosView } from "@/components/planos-view";
import { podePlanejar } from "@/lib/permissions";
import { requirePageAccess } from "@/lib/page-guard";
import { listPlanStages, listPlans, listProjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const user = await requirePageAccess("planos");

  const [plans, projects] = await Promise.all([listPlans(), listProjects()]);
  const visibleProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const nonBrandPlans = plans.filter((plan) => plan.kind !== "brand");
  const visiblePlans = user.accessibleProjectIds === "all" ? nonBrandPlans : nonBrandPlans.filter((p) => user.accessibleProjectIds.includes(p.projectId));

  const planStages = await listPlanStages(visiblePlans.map((plan) => ({ id: plan.id, projectId: plan.projectId })));

  return (
    <AdminShell active="planos" user={user}>
      <PlanosView initialPlans={visiblePlans} initialProjects={visibleProjects} planStages={planStages} canEdit={podePlanejar(user.role)} />
    </AdminShell>
  );
}
