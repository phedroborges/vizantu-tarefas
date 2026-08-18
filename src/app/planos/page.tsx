import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { PlanosView } from "@/components/planos-view";
import { getCurrentUser } from "@/lib/current-user";
import { listPlans, listProjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [plans, projects] = await Promise.all([listPlans(), listProjects()]);
  const visibleProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const visiblePlans = user.accessibleProjectIds === "all" ? plans : plans.filter((p) => user.accessibleProjectIds.includes(p.projectId));

  return (
    <AdminShell active="planos" user={user}>
      <PlanosView initialPlans={visiblePlans} initialProjects={visibleProjects} canEdit={user.role !== "visualizador"} />
    </AdminShell>
  );
}
