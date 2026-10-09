import { overdueDays } from "./dates";
import { CLOSED_TASK_STATUSES, type Tag, type Task, type TaskStatus } from "./types";

// A fila de um cliente: as demandas dele, de todos os planos e avulsas, na
// ordem em que precisam ser entregues e separadas pelo formato. É por aqui que
// a equipe criativa se guia — escolhe o cliente e vê o que fazer, sem abrir
// plano por plano nem a lista inteira de tarefas.

type QueueTask = Pick<Task, "id" | "name" | "status" | "dueDate" | "formatTagIds" | "assigneeId" | "planId">;

/** Etapas em que a demanda está na mão de quem cria. */
export const CREATION_STATUSES: TaskStatus[] = ["pronto_para_criacao", "em_criacao", "revisao", "ajuste"];

export type QueueScope = "criar" | "abertas" | "concluidas";

export const QUEUE_SCOPES: { value: QueueScope; label: string }[] = [
  { value: "criar", label: "Para criar" },
  { value: "abertas", label: "Todas abertas" },
  { value: "concluidas", label: "Finalizadas" },
];

export function inQueueScope(status: TaskStatus, scope: QueueScope): boolean {
  if (scope === "criar") return CREATION_STATUSES.includes(status);
  if (scope === "concluidas") return status === "finalizado";
  return !CLOSED_TASK_STATUSES.includes(status);
}

// Dentro do mesmo prazo, o que já voltou do cliente ou do revisor vem antes do
// que ainda nem começou: terminar o que está aberto libera a fila.
const STATUS_RANK: Partial<Record<TaskStatus, number>> = { ajuste: 0, em_criacao: 1, revisao: 2, pronto_para_criacao: 3 };

/** Prioridade de entrega: o mais atrasado primeiro, depois o prazo mais
 * próximo (sem prazo fica por último), depois a etapa mais adiantada. */
export function comparePriority(a: QueueTask, b: QueueTask, today: string): number {
  const late = overdueDays(b.dueDate, b.status, today) - overdueDays(a.dueDate, a.status, today);
  if (late) return late;
  const due = (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
  if (due) return due;
  const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
  return rank || a.name.localeCompare(b.name, "pt-BR");
}

export const NO_FORMAT_KEY = "__sem_formato__";

export type FormatGroup<T> = { key: string; label: string; tasks: T[]; late: number };

/** Separa por formato, na ordem dos formatos cadastrados, com cada grupo já
 * em ordem de prioridade. Grupo vazio não aparece. */
export function groupByFormat<T extends QueueTask>(tasks: T[], formatTags: Pick<Tag, "id" | "label">[], today: string): FormatGroup<T>[] {
  const known = new Set(formatTags.map((tag) => tag.id));
  const byFormat = new Map<string, T[]>();
  for (const task of tasks) {
    const key = task.formatTagIds.find((id) => known.has(id)) ?? NO_FORMAT_KEY;
    byFormat.set(key, [...(byFormat.get(key) ?? []), task]);
  }
  return [...formatTags.map((tag) => ({ key: tag.id, label: tag.label })), { key: NO_FORMAT_KEY, label: "Sem formato" }]
    .flatMap(({ key, label }) => {
      const group = byFormat.get(key);
      if (!group) return [];
      const sorted = [...group].sort((a, b) => comparePriority(a, b, today));
      return [{ key, label, tasks: sorted, late: sorted.filter((task) => overdueDays(task.dueDate, task.status, today) > 0).length }];
    });
}

export type QueueSummary = { toCreate: number; open: number; late: number };

export function queueSummary(tasks: QueueTask[], today: string): QueueSummary {
  return {
    toCreate: tasks.filter((task) => inQueueScope(task.status, "criar")).length,
    open: tasks.filter((task) => inQueueScope(task.status, "abertas")).length,
    late: tasks.filter((task) => overdueDays(task.dueDate, task.status, today) > 0).length,
  };
}

export type PlanProgress = { total: number; done: number; open: number; finished: boolean };

/** Quanto do plano já foi entregue. Plano terminado é o que tem itens e todos
 * estão finalizados (ou descartados): sai da frente na lista do cliente. */
export function planProgress(tasks: Pick<Task, "status">[]): PlanProgress {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "finalizado").length;
  const open = tasks.filter((task) => !CLOSED_TASK_STATUSES.includes(task.status)).length;
  return { total, done, open, finished: total > 0 && open === 0 };
}
