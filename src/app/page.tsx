import { AdminShell } from "@/components/admin-shell";
import { DashboardView } from "@/components/dashboard-view";
import { filterTasksByAccess, filterTasksByListAccess } from "@/lib/authz";
import { requirePageAccess } from "@/lib/page-guard";
import { listMembers, listProjects, listTags, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requirePageAccess("dashboard");

  const [allTasks, allProjects, members, tags] = await Promise.all([listTasks(), listProjects(), listMembers(), listTags()]);
  const tasks = filterTasksByListAccess(filterTasksByAccess(allTasks, user.accessibleProjectIds), user.accessibleListKinds);
  const projects = user.accessibleProjectIds === "all" ? allProjects : allProjects.filter((p) => user.accessibleProjectIds.includes(p.id));

  return (
    <AdminShell active="dashboard" user={user}>
      <DashboardView
        tasks={tasks}
        projects={projects}
        members={members}
        tags={tags}
        nowIso={new Date().toISOString()}
      />
    </AdminShell>
  );
}
