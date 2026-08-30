import { PLAN_STAGES } from "./types";
import type { PlanApprovalStatus, PlanItemApproval, PlanStage, TaskStatus } from "./types";

export type ApprovalStage = "copy" | "creative";

export function approvalStage(reviewVersion: number): ApprovalStage {
  return reviewVersion >= 100 ? "creative" : "copy";
}

export function approvalRound(reviewVersion: number): number {
  return reviewVersion >= 100 ? reviewVersion - 99 : reviewVersion;
}

export function isReviewDecision(status: PlanApprovalStatus): boolean {
  return status !== "pending";
}

export function formatRequiresCapture(formatLabels: string[]): boolean {
  return formatLabels.some((label) => {
    const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
    return /(^|\s)(video|reels?)(\s|$)/.test(normalized);
  });
}

export function taskStatusAfterClientDecision(stage: ApprovalStage, status: PlanApprovalStatus, needsCapture = false): TaskStatus {
  if (status === "rejected") return "problema";
  if (status === "changes_requested") return "ajuste";
  if (status === "approved") {
    if (stage === "creative") return "aprovado";
    return needsCapture ? "aguardando_captacao" : "pronto_para_criacao";
  }
  return stage === "creative" ? "para_aprovacao" : "aprovacao_copy";
}

export function nextApprovalReviewVersion(
  current: Pick<PlanItemApproval, "status" | "reviewVersion"> | undefined,
  taskStatus: TaskStatus,
  hasMaterialLink: boolean,
): number | undefined {
  if (!current || current.status === "pending") return undefined;

  if (taskStatus === "aprovacao_copy" && current.reviewVersion < 100) {
    return current.reviewVersion + 1;
  }

  if (taskStatus !== "para_aprovacao") return undefined;

  if (current.reviewVersion < 100) {
    if (current.status !== "approved") return current.reviewVersion + 1;
    return hasMaterialLink ? 100 : undefined;
  }

  return hasMaterialLink ? current.reviewVersion + 1 : undefined;
}

export function summarizeApprovalRound(approvals: Pick<PlanItemApproval, "status" | "reviewVersion">[], stage: ApprovalStage) {
  const scoped = approvals.filter((approval) => approvalStage(approval.reviewVersion) === stage);
  const reviewed = scoped.filter((approval) => isReviewDecision(approval.status)).length;
  const approved = scoped.filter((approval) => approval.status === "approved").length;
  const total = scoped.length;
  return {
    stage,
    round: scoped.reduce((highest, approval) => Math.max(highest, approvalRound(approval.reviewVersion)), 1),
    total,
    reviewed,
    approved,
    reviewedRate: total ? Math.round((reviewed / total) * 100) : 0,
    approvalRate: total ? Math.round((approved / total) * 100) : 0,
    fullyReviewed: total > 0 && reviewed === total,
  };
}

// A etapa do plano sai do LINK DE APROVAÇÃO: é criar o link que coloca o plano
// na frente do cliente, então é isso que torna o plano ativo. O único estado
// que vem depois é "aprovado", quando o cliente já fechou todos os criativos —
// senão um plano encerrado ficaria "ativo" pra sempre.
export function derivePlanStage(input: {
  hasClientLink: boolean;
  approvals: Pick<PlanItemApproval, "status" | "reviewVersion">[];
  taskCount: number;
}): PlanStage {
  const creative = input.approvals.filter((approval) => approvalStage(approval.reviewVersion) === "creative");
  const allCreativeApproved = input.taskCount > 0 && creative.length >= input.taskCount && creative.every((approval) => approval.status === "approved");
  if (allCreativeApproved) return "aprovado";
  return input.hasClientLink ? "ativo" : "rascunho";
}

export function planStageLabel(stage: PlanStage): string {
  return PLAN_STAGES.find((item) => item.value === stage)?.label || stage;
}

export function planStageTone(stage: PlanStage): string {
  return PLAN_STAGES.find((item) => item.value === stage)?.tone || "nao_iniciada";
}
