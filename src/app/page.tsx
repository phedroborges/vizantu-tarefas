import { buildDashboardMetrics } from "@/lib/dashboard-metrics";
import { AdminShell } from "@/components/admin-shell";
import { DashboardView } from "@/components/dashboard-view";
import { filterTasksByAccess, filterTasksByListAccess } from "@/lib/authz";
import { requirePageAccess } from "@/lib/page-guard";
import { listClientApprovalActivity, listClientLinkAccess, listMembers, listProjects, listTags, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requirePageAccess("dashboard");

  const [allTasks, allProjects, members, tags, events, links] = await Promise.all([
    listTasks({ projectIds: user.accessibleProjectIds, listKinds: user.accessibleListKinds }), listProjects(), listMembers(), listTags(),
    listClientApprovalActivity(), listClientLinkAccess(),
  ]);
  const tasks = filterTasksByListAccess(filterTasksByAccess(allTasks, user.accessibleProjectIds), user.accessibleListKinds);
  const projects = user.accessibleProjectIds === "all" ? allProjects : allProjects.filter((p) => user.accessibleProjectIds.includes(p.id));

  return (
    <AdminShell active="dashboard" user={user}>
      <DashboardView metrics={buildDashboardMetrics({ tasks, projects, members, tags, clientActivity: { events, links }, nowIso: new Date().toISOString() })} />
    </AdminShell>
  );
}
