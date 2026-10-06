import { NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { staleReadyTasks } from "@/lib/ready-nudge";
import { listProjects, listReadyTasksForAssignee } from "@/lib/storage";

// As demandas do usuário logado paradas em "Pronto para criação" além do
// limite. É o que o ReadyNudge busca no AdminShell para perguntar se o
// trabalho já começou.
export async function GET() {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  try {
    const stale = staleReadyTasks(await listReadyTasksForAssignee(auth.id), auth.id, Date.now());
    if (!stale.length) return NextResponse.json({ tasks: [] }, { headers: { "Cache-Control": "private, no-store" } });
    const projectNames = new Map((await listProjects()).map((project) => [project.id, project.name]));
    return NextResponse.json({
      tasks: stale.map(({ task, waitingMs }) => ({ id: task.id, name: task.name, projectName: projectNames.get(task.projectId) || "", waitingMs })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "carregar as tarefas prontas para criação");
  }
}
