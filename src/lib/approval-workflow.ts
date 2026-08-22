import type { PlanApprovalStatus, PlanItemApproval, TaskStatus } from "./types";

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

export function taskStatusAfterClientDecision(stage: ApprovalStage, status: PlanApprovalStatus): TaskStatus {
  if (status === "rejected") return "problema";
  if (status === "changes_requested") return "ajuste";
  if (status === "approved") return stage === "creative" ? "aprovado" : "texto_aprovado";
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
