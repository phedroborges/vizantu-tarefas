import type { Task } from "./types";

// Quanto tempo uma demanda pode ficar em "Pronto para criação" sem ninguém dar
// play antes de o responsável ser perguntado. O trabalho feito com a tarefa
// ainda em "Pronto" entra no painel como fila, e não como produção — o aviso
// existe para o status voltar a contar a verdade.
export const READY_NUDGE_HOURS = 24;
// "Ainda não comecei" silencia o aviso por este tempo, e não para sempre.
export const READY_NUDGE_SNOOZE_HOURS = 4;

export type ReadyTask = Pick<Task, "id" | "name" | "projectId" | "status" | "statusHistory" | "updatedAt" | "assigneeId">;

/** Desde quando a tarefa está em "Pronto para criação". Sem a entrada aberta
 * no histórico (status trocado por fora), vale a última atualização. */
export function readySince(task: ReadyTask): number | undefined {
  if (task.status !== "pronto_para_criacao") return undefined;
  const open = task.statusHistory.findLast((entry) => entry.status === "pronto_para_criacao" && !entry.exitedAt);
  const since = new Date(open?.enteredAt || task.updatedAt).getTime();
  return Number.isFinite(since) ? since : undefined;
}

/** As tarefas da pessoa paradas em "Pronto para criação" além do limite, da
 * que espera há mais tempo para a mais recente. */
export function staleReadyTasks(tasks: ReadyTask[], memberId: string, nowMs: number, limitHours = READY_NUDGE_HOURS): { task: ReadyTask; waitingMs: number }[] {
  return tasks.flatMap((task) => {
    if (task.assigneeId !== memberId) return [];
    const since = readySince(task);
    if (since === undefined || nowMs - since < limitHours * 3_600_000) return [];
    return [{ task, waitingMs: nowMs - since }];
  }).sort((a, b) => b.waitingMs - a.waitingMs);
}
