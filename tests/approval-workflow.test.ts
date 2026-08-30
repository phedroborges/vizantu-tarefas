import { describe, expect, it } from "vitest";
import { approvalRound, approvalStage, derivePlanStage, formatRequiresCapture, nextApprovalReviewVersion, planStageLabel, summarizeApprovalRound, taskStatusAfterClientDecision } from "../src/lib/approval-workflow";

describe("fluxo de aprovação em duas etapas", () => {
  it("separa versões de texto e criativo em rodadas legíveis", () => {
    expect(approvalStage(2)).toBe("copy");
    expect(approvalRound(2)).toBe(2);
    expect(approvalStage(101)).toBe("creative");
    expect(approvalRound(101)).toBe(2);
  });

  it("considera qualquer decisão como conteúdo revisado", () => {
    const summary = summarizeApprovalRound([
      { status: "approved", reviewVersion: 1 },
      { status: "changes_requested", reviewVersion: 1 },
      { status: "rejected", reviewVersion: 1 },
      { status: "pending", reviewVersion: 1 },
    ], "copy");
    expect(summary.reviewedRate).toBe(75);
    expect(summary.approvalRate).toBe(25);
    expect(summary.fullyReviewed).toBe(false);
  });

  it("marca 100% revisado mesmo quando nem tudo foi aprovado", () => {
    const summary = summarizeApprovalRound([
      { status: "approved", reviewVersion: 1 },
      { status: "changes_requested", reviewVersion: 1 },
      { status: "rejected", reviewVersion: 1 },
    ], "copy");
    expect(summary.reviewedRate).toBe(100);
    expect(summary.approvalRate).toBe(33);
    expect(summary.fullyReviewed).toBe(true);
  });

  it("mantém texto e criativo coerentes com o status interno", () => {
    expect(taskStatusAfterClientDecision("copy", "approved", false)).toBe("pronto_para_criacao");
    expect(taskStatusAfterClientDecision("copy", "approved", true)).toBe("aguardando_captacao");
    expect(taskStatusAfterClientDecision("copy", "changes_requested")).toBe("ajuste");
    expect(taskStatusAfterClientDecision("copy", "rejected")).toBe("problema");
    expect(taskStatusAfterClientDecision("creative", "approved")).toBe("aprovado");
    expect(taskStatusAfterClientDecision("creative", "changes_requested")).toBe("ajuste");
    expect(taskStatusAfterClientDecision("creative", "rejected")).toBe("problema");
  });

  it("manda somente formatos de vídeo para captação", () => {
    expect(formatRequiresCapture(["Vídeo"])).toBe(true);
    expect(formatRequiresCapture(["Reels"])).toBe(true);
    expect(formatRequiresCapture(["Carrossel"])).toBe(false);
    expect(formatRequiresCapture(["Estático", "Impresso"])).toBe(false);
    expect(formatRequiresCapture(["Stories"])).toBe(false);
  });

  it("reabre uma nova rodada de texto após ajuste ou reprovação", () => {
    expect(nextApprovalReviewVersion({ status: "changes_requested", reviewVersion: 1 }, "para_aprovacao", true)).toBe(2);
    expect(nextApprovalReviewVersion({ status: "rejected", reviewVersion: 2 }, "aprovacao_copy", false)).toBe(3);
  });

  it("só inicia a criação depois do texto aprovado e com material anexado", () => {
    expect(nextApprovalReviewVersion({ status: "approved", reviewVersion: 1 }, "para_aprovacao", false)).toBeUndefined();
    expect(nextApprovalReviewVersion({ status: "approved", reviewVersion: 1 }, "para_aprovacao", true)).toBe(100);
  });

  it("reabre uma nova rodada de criativo com o link do material", () => {
    expect(nextApprovalReviewVersion({ status: "changes_requested", reviewVersion: 100 }, "para_aprovacao", true)).toBe(101);
    expect(nextApprovalReviewVersion({ status: "rejected", reviewVersion: 101 }, "para_aprovacao", false)).toBeUndefined();
  });
});

describe("etapa derivada do plano", () => {
  const creative = (status: "pending" | "approved" | "changes_requested" | "rejected") => ({ status, reviewVersion: 100 });
  const copy = (status: "pending" | "approved") => ({ status, reviewVersion: 1 });

  it("fica em rascunho enquanto não existe link de aprovação", () => {
    expect(derivePlanStage({ hasClientLink: false, approvals: [], taskCount: 0 })).toBe("rascunho");
    expect(derivePlanStage({ hasClientLink: false, approvals: [], taskCount: 14 })).toBe("rascunho");
  });

  it("vira ativo assim que o link de aprovação existe, mesmo sem nada enviado", () => {
    expect(derivePlanStage({ hasClientLink: true, approvals: [], taskCount: 20 })).toBe("ativo");
  });

  it("segue ativo durante as rodadas de aprovação", () => {
    expect(derivePlanStage({ hasClientLink: true, approvals: [copy("approved"), copy("approved")], taskCount: 2 })).toBe("ativo");
    expect(derivePlanStage({ hasClientLink: true, approvals: [creative("pending"), creative("approved")], taskCount: 2 })).toBe("ativo");
  });

  it("fecha em aprovado quando o cliente aprova todos os criativos", () => {
    expect(derivePlanStage({ hasClientLink: true, approvals: [creative("approved"), creative("approved")], taskCount: 2 })).toBe("aprovado");
  });

  it("não fecha com criativo reprovado nem com item de fora da rodada", () => {
    expect(derivePlanStage({ hasClientLink: true, approvals: [creative("approved"), creative("rejected")], taskCount: 2 })).toBe("ativo");
    expect(derivePlanStage({ hasClientLink: true, approvals: [creative("approved")], taskCount: 3 })).toBe("ativo");
  });

  it("traduz as etapas pro português", () => {
    expect(planStageLabel("ativo")).toBe("Ativo");
    expect(planStageLabel("aprovado")).toBe("Aprovado");
  });
});
