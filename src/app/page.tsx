import { buildDashboardReport } from "@/lib/dashboard-metrics";
import { dayRangeInstants, resolveDashboardPeriod } from "@/lib/dashboard-period";
import { AdminShell } from "@/components/admin-shell";
import { DashboardView } from "@/components/dashboard-view";
import { filterTasksByAccess, filterTasksByListAccess } from "@/lib/authz";
import { todayIso } from "@/lib/dates";
import { requirePageAccess } from "@/lib/page-guard";
import { listClientLinkAccess } from "@/lib/client-links";
import { listClientApprovalActivity, listMembers, listProjects, listTags, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

type HomeProps = { searchParams: Promise<{ periodo?: string | string[]; de?: string | string[]; ate?: string | string[] }> };

export default async function Home({ searchParams }: HomeProps) {
  const user = await requirePageAccess("dashboard");
  const period = resolveDashboardPeriod(await searchParams, todayIso());

  const [allTasks, allProjects, members, tags, events, links] = await Promise.all([
    // O painel mede períodos passados, então lê também os planos de meses encerrados.
    listTasks({ projectIds: user.accessibleProjectIds, listKinds: user.accessibleListKinds, all: true, includeArchivedPlans: true }), listProjects(), listMembers(), listTags(),
    listClientApprovalActivity(), listClientLinkAccess(),
  ]);
  const tasks = filterTasksByListAccess(filterTasksByAccess(allTasks, user.accessibleProjectIds), user.accessibleListKinds);
  const projects = user.accessibleProjectIds === "all" ? allProjects : allProjects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const { metrics, comparison } = buildDashboardReport({
    tasks, projects, members, tags, clientActivity: { events, links }, nowIso: new Date().toISOString(),
    window: period.range && dayRangeInstants(period.range),
    previous: period.previous && dayRangeInstants(period.previous),
  });

  return (
    <AdminShell active="dashboard" user={user}>
      <DashboardView metrics={metrics} comparison={comparison} period={period} />
    </AdminShell>
  );
}
