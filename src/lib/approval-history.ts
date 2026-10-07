// O que aconteceu com cada pedido do cliente.
//
// O cliente pede um ajuste e a equipe decide o caminho conforme o pedido: às
// vezes o texto volta para ele aprovar de novo, às vezes o ajuste é tão simples
// que o conteúdo segue direto para a captação ou para a criação. O status da
// aprovação, sozinho, não conta essa história — ele fica em "ajuste
// solicitado" até existir uma nova rodada, mesmo depois de o trabalho ter sido
// feito. Aqui a gente junta três coisas que já estão gravadas (a resposta do
// cliente, o histórico de status e o histórico de edições do texto) para dizer
// o que foi pedido, o que foi feito e o que mudou.

import { approvalRound, approvalStage, type ApprovalStage } from "./approval-workflow";
import type { Comment, PlanApprovalEvent, PlanApprovalStatus, StatusHistoryEntry, TaskStatus } from "./types";

/** "adjusted": o pedido foi atendido e o conteúdo seguiu sem nova aprovação.
 * "resent": o pedido foi atendido e o conteúdo voltou para o cliente revisar. */
export type ApprovalDisplay = PlanApprovalStatus | "adjusted" | "resent";

// Enquanto a tarefa está num destes status, o pedido ainda está sendo resolvido.
const REWORK: Record<ApprovalStage, ReadonlySet<string>> = {
  copy: new Set<TaskStatus>(["ajuste", "problema", "rascunho", "aguardando_informacao"]),
  creative: new Set<TaskStatus>(["ajuste", "problema", "em_criacao", "revisao"]),
};
const AWAITING_CLIENT: Record<ApprovalStage, TaskStatus> = { copy: "aprovacao_copy", creative: "para_aprovacao" };

export function approvalDisplay(input: {
  approvalStatus: PlanApprovalStatus;
  reviewVersion: number;
  taskStatus: string;
  /** O cliente já pediu ajuste ou reprovou este conteúdo nesta etapa. */
  hadRequest: boolean;
}): ApprovalDisplay {
  const stage = approvalStage(input.reviewVersion);
  const withClient = input.taskStatus === AWAITING_CLIENT[stage];
  if (input.approvalStatus === "changes_requested" || input.approvalStatus === "rejected") {
    // Já voltou para o cliente, mas a tela ainda não recebeu a rodada nova.
    if (withClient) return "resent";
    return REWORK[stage].has(input.taskStatus) ? input.approvalStatus : "adjusted";
  }
  if (input.approvalStatus === "pending" && input.hadRequest && withClient) return "resent";
  return input.approvalStatus;
}

export const APPROVAL_DISPLAY_LABELS: Record<ApprovalDisplay, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  changes_requested: "Ajuste solicitado",
  rejected: "Reprovado",
  adjusted: "Ajuste aplicado",
  resent: "Reenviado ao cliente",
};

export type ApprovalHistoryEntry = {
  id: string;
  stage: ApprovalStage;
  round: number;
  action: "approved" | "changes_requested" | "rejected";
  reviewerName?: string;
  comment?: string;
  at: string;
  /** Só em pedido de ajuste e reprovação: o que a equipe fez depois.
   * open = ainda ajustando; applied = ajustou e seguiu; resent = ajustou e
   * devolveu para o cliente aprovar. */
  outcome?: "open" | "applied" | "resent";
  resolvedAt?: string;
  /** O texto como estava quando o cliente respondeu, e como ficou depois.
   * Só vêm quando o texto de fato mudou. */
  textBefore?: string;
  textAfter?: string;
};

// As datas vêm de lugares diferentes (colunas do banco e JSON gravado pelo
// app) e nem sempre no mesmo formato: comparar como número, nunca como texto.
const ms = (iso: string) => new Date(iso).getTime();

/** O texto da tarefa num instante passado, desfazendo de trás para frente as
 * edições registradas depois dele. Devolve undefined quando alguma edição não
 * guardou o valor anterior e não dá para reconstruir. */
function descriptionAt(current: string, edits: Comment[], at: number): string | undefined {
  let text = current;
  for (const edit of edits) {
    if (ms(edit.createdAt) <= at) break;
    if (typeof edit.oldValue === "string") text = edit.oldValue;
    else if (edit.oldValue === null) text = "";
    else return undefined;
  }
  return text;
}

export function buildApprovalHistory(
  task: { description?: string | null; statusHistory: StatusHistoryEntry[]; comments: Comment[] },
  events: Pick<PlanApprovalEvent, "id" | "action" | "comment" | "reviewerName" | "reviewVersion" | "createdAt">[],
): ApprovalHistoryEntry[] {
  const decisions = events
    .filter((event): event is typeof event & { action: ApprovalHistoryEntry["action"] } => event.action === "approved" || event.action === "changes_requested" || event.action === "rejected")
    .sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  const transitions = [...task.statusHistory].sort((a, b) => ms(a.enteredAt) - ms(b.enteredAt));
  // Da edição mais recente para a mais antiga, que é a ordem de desfazer.
  const edits = task.comments.filter((comment) => comment.kind === "activity" && comment.fieldKey === "description").sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  const current = task.description ?? "";

  return decisions.map((event, index) => {
    const version = event.reviewVersion ?? 1;
    const stage = approvalStage(version);
    const entry: ApprovalHistoryEntry = {
      id: event.id, stage, round: approvalRound(version), action: event.action,
      reviewerName: event.reviewerName?.trim() || undefined, comment: event.comment?.trim() || undefined, at: event.createdAt,
    };
    if (event.action === "approved") return entry;

    // A resposta do cliente joga a tarefa em Ajuste (ou Problema) antes de o
    // evento ser gravado; a primeira saída desse estado é a resolução.
    const resolved = transitions.find((transition) => ms(transition.enteredAt) > ms(event.createdAt) && !REWORK[stage].has(transition.status));
    entry.outcome = !resolved ? "open" : resolved.status === AWAITING_CLIENT[stage] ? "resent" : "applied";
    entry.resolvedAt = resolved?.enteredAt;

    // O "depois" vai até a próxima resposta do cliente: um ajuste feito logo
    // depois de mover o card ainda pertence a este pedido.
    if (stage === "copy" && resolved) {
      const next = decisions[index + 1]?.createdAt;
      const before = descriptionAt(current, edits, ms(event.createdAt));
      const after = next ? descriptionAt(current, edits, ms(next)) : current;
      if (before !== undefined && after !== undefined && before.trim() !== after.trim()) {
        entry.textBefore = before;
        entry.textAfter = after;
      }
    }
    return entry;
  });
}

export type DiffPart = { type: "same" | "added" | "removed"; text: string };

/** Compara dois textos palavra por palavra. Serve para mostrar ao cliente
 * exatamente o que mudou, sem fazer ele reler tudo. */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  // Texto grande demais para a tabela: mostra o antes e o depois inteiros.
  if (a.length * b.length > 4_000_000) return [{ type: "removed", text: before }, { type: "added", text: after }];

  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * width + j] = a[i] === b[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = parts.at(-1);
    if (last?.type === type) last.text += text; else parts.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push("same", a[i]); i += 1; j += 1; }
    else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) { push("removed", a[i]); i += 1; }
    else { push("added", b[j]); j += 1; }
  }
  while (i < a.length) { push("removed", a[i]); i += 1; }
  while (j < b.length) { push("added", b[j]); j += 1; }
  return parts;
}
