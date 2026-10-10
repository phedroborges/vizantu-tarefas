// Os avisos que o grupo da EQUIPE recebe: o que está atrasado e com quem, o
// que está travado por falta de informação e quem é o mais rápido na criação.
//
// Como messages.ts, aqui só tem regra e texto, sem banco nem rede: é o que dá
// para testar e o que a tela usa para mostrar a prévia.

import { formatDuration } from "../dates";
import { parseDescription } from "../description-sections";
import { findTaskGaps } from "../task-readiness";
import type { TaskKind, TaskStatus } from "../types";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** No grupo a pessoa é chamada pelo primeiro nome, como numa conversa. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

// ---------- Atrasadas ----------

export type OverdueItem = { name: string; projectName: string; lateDays: number; statusLabel: string; assigneeName?: string };

/** Quantas demandas aparecem nomeadas. O resto vira "e mais N": a lista
 * inteira no grupo é parede de texto que ninguém lê. */
export const OVERDUE_LIMIT = 5;

export function composeOverdueDigest(items: OverdueItem[], link?: string): string | undefined {
  if (!items.length) return undefined;
  const sorted = [...items].sort((a, b) => b.lateDays - a.lateDays || a.name.localeCompare(b.name, "pt-BR"));
  const shown = sorted.slice(0, OVERDUE_LIMIT);
  const rest = sorted.length - shown.length;
  const lines = shown.map((item, index) => [
    `${index + 1}. *${item.name}*`,
    `   ${item.projectName} · há ${plural(item.lateDays, "dia", "dias")} · ${item.statusLabel}`,
    `   👤 ${item.assigneeName ? firstName(item.assigneeName) : "Sem responsável"}`,
  ].join("\n"));
  return [
    `⏰ *${items.length === 1 ? "1 demanda atrasada" : `${items.length} demandas atrasadas`} hoje*`,
    lines.join("\n\n"),
    [rest ? `E mais ${plural(rest, "atrasada", "atrasadas")}.` : "", link ? `Ver todas: ${link}` : ""].filter(Boolean).join(" "),
  ].filter(Boolean).join("\n\n");
}

// ---------- Sem informação ----------

export type InfoTask = {
  status: TaskStatus;
  kind: TaskKind;
  /** Item de um plano de conteúdo: tem legenda mesmo que o tipo diga "tarefa". */
  planContent?: boolean;
  description?: string | null;
  driveLink?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  formatTagIds: string[];
  channelTagIds: string[];
};

// A criação já começou (ou já passou): a essa altura a legenda tinha que
// existir, porque é ela que vai com a peça para o cliente e para a publicação.
const NEEDS_CAPTION = new Set<TaskStatus>(["pronto_para_criacao", "em_criacao", "revisao", "ajuste", "para_aprovacao", "aprovado"]);

/** O que falta para a demanda andar. Rascunho não entra: rascunho incompleto é
 * o esperado, e cobrar isso todo dia ensina o time a ignorar o aviso. */
export function missingInfo(task: InfoTask): string[] {
  if (task.status === "rascunho") return [];
  const content = task.kind === "conteudo" || Boolean(task.planContent);
  const missing: string[] = [];
  if (task.status === "aguardando_informacao") missing.push("parada em Aguardando informação");
  if (content && NEEDS_CAPTION.has(task.status) && !parseDescription(task.description || undefined).legenda.trim()) missing.push("sem legenda");
  for (const gap of findTaskGaps({ ...task, kind: content ? "conteudo" : task.kind })) missing.push(gap.label.toLocaleLowerCase("pt-BR"));
  return missing;
}

export type InfoGroup = { person?: string; items: { name: string; projectName: string; missing: string[] }[] };

const INFO_LIMIT = 6;

export function composeMissingInfoDigest(groups: InfoGroup[], link?: string): string | undefined {
  const filled = groups.filter((group) => group.items.length);
  if (!filled.length) return undefined;
  // Quem tem dono vem primeiro, em ordem alfabética; o que ninguém assumiu fecha.
  const ordered = [...filled].sort((a, b) => Number(!a.person) - Number(!b.person) || (a.person ?? "").localeCompare(b.person ?? "", "pt-BR"));
  const blocks = ordered.map((group) => {
    const shown = group.items.slice(0, INFO_LIMIT);
    const rest = group.items.length - shown.length;
    return [
      group.person ? `*${firstName(group.person)}*, ${group.items.length === 1 ? "esta demanda precisa" : "estas demandas precisam"} de você:` : "*Sem dono definido* (alguém precisa assumir):",
      ...shown.map((item) => `• ${item.name} (${item.projectName}): ${item.missing.join(", ")}`),
      rest ? `• e mais ${rest}` : "",
    ].filter(Boolean).join("\n");
  });
  return ["📝 *Demandas sem informação*", ...blocks, link ? `Abrir as tarefas: ${link}` : ""].filter(Boolean).join("\n\n");
}

// ---------- O mais rápido ----------

export type SpeedEntry = { memberId: string; name: string; averageMs: number; deliveries: number };

/** Com menos entregas que isso a média é sorte, não ritmo. */
export const MIN_DELIVERIES = 3;
export const RANKING_DAYS = 30;

/** Do mais rápido para o mais lento, só quem tem base para ser comparado. */
export function speedRanking(entries: { memberId: string; name: string; averageMs?: number; deliveries: number }[]): SpeedEntry[] {
  return entries
    .filter((entry): entry is SpeedEntry => entry.averageMs !== undefined && entry.deliveries >= MIN_DELIVERIES)
    .sort((a, b) => a.averageMs - b.averageMs || b.deliveries - a.deliveries);
}

/** O aviso sai quando a liderança muda de mão (ou na primeira vez). Quem foi
 * ultrapassado é o líder anterior, se ainda estiver no ranking. */
export function composeFastestNotice(ranking: SpeedEntry[], previousLeaderId?: string): string | undefined {
  const leader = ranking[0];
  if (!leader || leader.memberId === previousLeaderId) return undefined;
  const passed = ranking.find((entry) => entry.memberId === previousLeaderId);
  const pace = `Média de *${formatDuration(leader.averageMs)}* por entrega nos últimos ${RANKING_DAYS} dias (${plural(leader.deliveries, "entrega", "entregas")}).`;
  if (passed) return `🏆 *${firstName(leader.name)}*, você acaba de se tornar o designer mais rápido da equipe! Passou ${firstName(passed.name)}.\n\n${pace}`;
  const runnerUp = ranking[1];
  return `🏆 *${firstName(leader.name)}* é o designer mais rápido da equipe${runnerUp ? `, à frente de ${firstName(runnerUp.name)}` : ""}.\n\n${pace}`;
}
