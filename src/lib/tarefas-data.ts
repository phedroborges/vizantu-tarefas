import type { CurrentUser } from "@/lib/current-user";
import { filterTasksByAccess, filterTasksByListAccess } from "@/lib/authz";
import { listMembers, listProjects, listStatusColors, listTags, listTasks } from "@/lib/storage";

// Compartilhado entre /tarefas e /tarefas/[id] — mesma busca + filtro por
// acesso, pra não divergir entre as duas rotas.
export async function loadTarefasData(user: CurrentUser) {
  const [tasks, projects, members, formatTags, channelTags, statusColors] = await Promise.all([
    listTasks(),
    listProjects(),
    listMembers(),
    listTags("formato"),
    listTags("canal"),
    listStatusColors(),
  ]);

  const visibleProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const byProject = filterTasksByAccess(tasks, user.accessibleProjectIds);
  const visibleTasks = filterTasksByListAccess(byProject, user.accessibleListKinds);

  return { tasks: visibleTasks, projects: visibleProjects, members, formatTags, channelTags, statusColors };
}
