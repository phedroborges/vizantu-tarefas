import type { CurrentUser } from "@/lib/current-user";
import { listMembers, listProjects, listTags, listTasks } from "@/lib/storage";

// Compartilhado entre /tarefas e /tarefas/[id] — mesma busca + filtro por
// acesso, pra não divergir entre as duas rotas.
export async function loadTarefasData(user: CurrentUser) {
  const [tasks, projects, members, formatTags, channelTags] = await Promise.all([
    listTasks(),
    listProjects(),
    listMembers(),
    listTags("formato"),
    listTags("canal"),
  ]);

  const visibleProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((p) => user.accessibleProjectIds.includes(p.id));
  const visibleTasks = user.accessibleProjectIds === "all" ? tasks : tasks.filter((t) => user.accessibleProjectIds.includes(t.projectId));

  return { tasks: visibleTasks, projects: visibleProjects, members, formatTags, channelTags };
}
