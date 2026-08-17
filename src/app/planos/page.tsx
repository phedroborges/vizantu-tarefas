import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AnnouncementsPanel } from "@/components/announcements-panel";
import { PlanosView } from "@/components/planos-view";
import { getCurrentUser } from "@/lib/current-user";
import { listMembers, listPlans, listProjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [plans, projects, members] = await Promise.all([listPlans(), listProjects(), listMembers()]);
  const visibleProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const visiblePlans = user.accessibleProjectIds === "all" ? plans : plans.filter((p) => user.accessibleProjectIds.includes(p.projectId));

  return (
    <AdminShell active="planos" user={user}>
      <PlanosView initialPlans={visiblePlans} initialProjects={visibleProjects} canEdit={user.role !== "visualizador"} />
      {user.role === "dono" || user.role === "editor" ? (
        <AnnouncementsPanel members={members.filter((m) => m.active)} currentUserRole={user.role} />
      ) : null}
    </AdminShell>
  );
}
