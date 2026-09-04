import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { DashboardView } from "@/components/dashboard-view";
import { filterTasksByAccess, filterTasksByListAccess } from "@/lib/authz";
import { isOverdue } from "@/lib/dates";
import { getCurrentUser } from "@/lib/current-user";
import { listMembers, listProjects, listTasks } from "@/lib/storage";
import { TASK_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

function groupOf(status: string) {
  return TASK_STATUSES.find((item) => item.value === status)?.group;
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [allTasks, allProjects, members] = await Promise.all([listTasks(), listProjects(), listMembers()]);
  const tasks = filterTasksByListAccess(filterTasksByAccess(allTasks, user.accessibleProjectIds), user.accessibleListKinds);
  const projects = user.accessibleProjectIds === "all" ? allProjects : allProjects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const memberById = new Map(members.map((member) => [member.id, member]));

  const total = tasks.length;
  // "Finalizado" é o verdadeiro estado de conclusão (quando a peça foi publicada).
  const done = tasks.filter((task) => task.status === "finalizado").length;
  const inProgress = tasks.filter((task) => groupOf(task.status) === "em_andamento").length;
  const overdue = tasks.filter((task) => isOverdue(task.dueDate, task.status)).length;

  const assigneeCounts = new Map<string, number>();
  tasks.forEach((task) => {
    if (!task.assigneeId) return;
    assigneeCounts.set(task.assigneeId, (assigneeCounts.get(task.assigneeId) || 0) + 1);
  });
  const ranking = Array.from(assigneeCounts.entries())
    .map(([assigneeId, count]) => ({ name: memberById.get(assigneeId)?.name || "Ex-membro", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const maxCount = ranking[0]?.count || 1;

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const projectOverview = projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const projectDone = projectTasks.filter((task) => task.status === "finalizado").length;
    const rate = projectTasks.length ? Math.round((projectDone / projectTasks.length) * 100) : 0;
    return { project, total: projectTasks.length, done: projectDone, rate };
  });

  return (
    <AdminShell active="dashboard" user={user}>
      <DashboardView
        tasks={tasks}
        projectById={projectById}
        projectsCount={projects.length}
        total={total}
        done={done}
        inProgress={inProgress}
        overdue={overdue}
        projectOverview={projectOverview}
        ranking={ranking}
        maxCount={maxCount}
      />
    </AdminShell>
  );
}
