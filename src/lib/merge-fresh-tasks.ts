import type { Task } from "@/lib/types";

/** Encaixa a lista recém-buscada no que já está na tela.
 *
 * Vale o servidor: tarefa nova entra, alterada troca, excluída sai. Duas
 * exceções. A tarefa aberta (`keepId`) fica na versão local, mesmo que tenha
 * sumido do servidor, pra não mexer no que a pessoa está editando. E as
 * contagens do calendário, que vêm de outra consulta, são reaproveitadas pra
 * não serem buscadas de novo a cada rodada. */
export function mergeFreshTasks(current: Task[], fresh: Task[], keepId?: string): Task[] {
  const local = new Map(current.map((task) => [task.id, task]));
  const kept = keepId ? local.get(keepId) : undefined;
  const merged = fresh.map((task) => {
    if (kept && task.id === kept.id) return kept;
    const previous = local.get(task.id);
    if (!previous || !task.preview) return task;
    return { ...task, commentCount: task.commentCount ?? previous.commentCount, imageCount: task.imageCount ?? previous.imageCount };
  });
  return kept && !fresh.some((task) => task.id === kept.id) ? [kept, ...merged] : merged;
}
