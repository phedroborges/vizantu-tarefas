import { describe, expect, it } from "vitest";
import { approvalDisplay, buildApprovalHistory, diffWords } from "../src/lib/approval-history";
import type { Comment, StatusHistoryEntry } from "../src/lib/types";

const at = (day: number, hour = 12) => `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const status = (value: StatusHistoryEntry["status"], enteredAt: string): StatusHistoryEntry => ({ status: value, enteredAt, exitedAt: null });
const edit = (createdAt: string, oldValue: unknown, newValue: unknown): Comment => ({ id: createdAt, author: "Sistema", text: "", createdAt, kind: "activity", fieldKey: "description", oldValue, newValue });
const pedido = (createdAt: string, reviewVersion = 1, action: "changes_requested" | "rejected" | "approved" = "changes_requested") => ({ id: `e-${createdAt}`, action, comment: "Trocar Boteco por Buteco", reviewerName: "Richard", reviewVersion, createdAt });

describe("selo da aprovação depois de um pedido", () => {
  const base = { approvalStatus: "changes_requested" as const, reviewVersion: 1, hadRequest: true };

  it("continua como ajuste solicitado enquanto a tarefa está em ajuste", () => {
    expect(approvalDisplay({ ...base, taskStatus: "ajuste" })).toBe("changes_requested");
  });

  // O caso que originou isto: o ajuste era simples, o conteúdo seguiu direto
  // para a produção e o selo ficava preso em "ajuste solicitado".
  it("vira ajuste aplicado quando o conteúdo segue sem nova aprovação", () => {
    expect(approvalDisplay({ ...base, taskStatus: "pronto_para_criacao" })).toBe("adjusted");
    expect(approvalDisplay({ ...base, taskStatus: "aguardando_captacao" })).toBe("adjusted");
  });

  it("vira reenviado quando o texto volta para o cliente", () => {
    // A tela ainda não recebeu a rodada nova…
    expect(approvalDisplay({ ...base, taskStatus: "aprovacao_copy" })).toBe("resent");
    // …e depois de receber.
    expect(approvalDisplay({ approvalStatus: "pending", reviewVersion: 2, taskStatus: "aprovacao_copy", hadRequest: true })).toBe("resent");
  });

  it("não chama de reenviado o que o cliente nunca respondeu", () => {
    expect(approvalDisplay({ approvalStatus: "pending", reviewVersion: 2, taskStatus: "aprovacao_copy", hadRequest: false })).toBe("pending");
  });

  it("na criação, voltar para produzir ainda é ajuste em andamento", () => {
    const criacao = { approvalStatus: "changes_requested" as const, reviewVersion: 100, hadRequest: true };
    expect(approvalDisplay({ ...criacao, taskStatus: "em_criacao" })).toBe("changes_requested");
    expect(approvalDisplay({ ...criacao, taskStatus: "para_aprovacao" })).toBe("resent");
    expect(approvalDisplay({ ...criacao, taskStatus: "aprovado" })).toBe("adjusted");
  });

  it("não mexe em aprovado nem em reprovado parado", () => {
    expect(approvalDisplay({ approvalStatus: "approved", reviewVersion: 1, taskStatus: "pronto_para_criacao", hadRequest: true })).toBe("approved");
    expect(approvalDisplay({ approvalStatus: "rejected", reviewVersion: 1, taskStatus: "problema", hadRequest: true })).toBe("rejected");
  });
});

describe("histórico de um pedido de ajuste", () => {
  it("mostra o pedido como aberto enquanto a tarefa está em ajuste", () => {
    const [entry] = buildApprovalHistory({ description: "Texto", statusHistory: [status("aprovacao_copy", at(1)), status("ajuste", at(2))], comments: [] }, [pedido(at(2, 13))]);
    expect(entry).toMatchObject({ action: "changes_requested", stage: "copy", round: 1, reviewerName: "Richard", comment: "Trocar Boteco por Buteco", outcome: "open" });
    expect(entry.resolvedAt).toBeUndefined();
    expect(entry.textBefore).toBeUndefined();
  });

  it("marca como aplicado, com o antes e o depois, quando segue direto para a criação", () => {
    const [entry] = buildApprovalHistory({
      description: "Convite para o Buteco",
      statusHistory: [status("aprovacao_copy", at(1)), status("ajuste", at(2)), status("pronto_para_criacao", at(3))],
      comments: [edit(at(2, 20), "Convite para o Boteco", "Convite para o Buteco")],
    }, [pedido(at(2, 13))]);
    expect(entry).toMatchObject({ outcome: "applied", resolvedAt: at(3), textBefore: "Convite para o Boteco", textAfter: "Convite para o Buteco" });
  });

  it("marca como reenviado quando o texto volta para o cliente", () => {
    const [entry] = buildApprovalHistory({
      description: "Novo", statusHistory: [status("ajuste", at(2)), status("aprovacao_copy", at(4))], comments: [edit(at(3), "Velho", "Novo")],
    }, [pedido(at(2, 13))]);
    expect(entry).toMatchObject({ outcome: "resent", resolvedAt: at(4), textBefore: "Velho", textAfter: "Novo" });
  });

  // Mover o card primeiro e corrigir o texto depois é comum: a correção ainda
  // pertence ao pedido.
  it("conta a edição feita depois de mover o card", () => {
    const [entry] = buildApprovalHistory({
      description: "Novo", statusHistory: [status("ajuste", at(2)), status("pronto_para_criacao", at(3))], comments: [edit(at(5), "Velho", "Novo")],
    }, [pedido(at(2, 13))]);
    expect(entry).toMatchObject({ outcome: "applied", textBefore: "Velho", textAfter: "Novo" });
  });

  it("separa as edições de cada rodada", () => {
    const history = buildApprovalHistory({
      description: "v3",
      statusHistory: [status("ajuste", at(2)), status("aprovacao_copy", at(4)), status("ajuste", at(6)), status("pronto_para_criacao", at(8))],
      comments: [edit(at(3), "v1", "v2"), edit(at(7), "v2", "v3")],
    }, [pedido(at(2, 13)), pedido(at(6, 13), 2)]);
    expect(history[0]).toMatchObject({ round: 1, outcome: "resent", textBefore: "v1", textAfter: "v2" });
    expect(history[1]).toMatchObject({ round: 2, outcome: "applied", textBefore: "v2", textAfter: "v3" });
  });

  it("não inventa comparação quando o texto não mudou ou não dá para reconstruir", () => {
    const semMudanca = buildApprovalHistory({ description: "Igual", statusHistory: [status("ajuste", at(2)), status("pronto_para_criacao", at(3))], comments: [] }, [pedido(at(2, 13))]);
    expect(semMudanca[0]).toMatchObject({ outcome: "applied" });
    expect(semMudanca[0].textBefore).toBeUndefined();
    // Edição antiga, gravada sem o valor anterior.
    const semValor = buildApprovalHistory({ description: "Novo", statusHistory: [status("ajuste", at(2)), status("pronto_para_criacao", at(3))], comments: [edit(at(3), undefined, undefined)] }, [pedido(at(2, 13))]);
    expect(semValor[0].textBefore).toBeUndefined();
  });

  it("compara datas em formatos diferentes pelo instante, não pelo texto", () => {
    const [entry] = buildApprovalHistory({
      description: "Novo", statusHistory: [status("ajuste", "2026-10-02T12:00:00.000Z"), status("pronto_para_criacao", "2026-10-03T12:00:00.000Z")], comments: [edit("2026-10-02T20:00:00.000Z", "Velho", "Novo")],
    }, [pedido("2026-10-02T13:00:00.5+00:00")]);
    expect(entry).toMatchObject({ outcome: "applied", textBefore: "Velho", textAfter: "Novo" });
  });

  it("guarda as aprovações e ignora as reaberturas", () => {
    const history = buildApprovalHistory({ description: "", statusHistory: [], comments: [] }, [pedido(at(2), 1, "approved"), { id: "r", action: "reopened", reviewVersion: 2, createdAt: at(3) }]);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ action: "approved" });
    expect(history[0].outcome).toBeUndefined();
  });

  it("na criação informa o desfecho, mas não compara texto", () => {
    const [entry] = buildApprovalHistory({
      description: "Novo", statusHistory: [status("ajuste", at(2)), status("para_aprovacao", at(4))], comments: [edit(at(3), "Velho", "Novo")],
    }, [pedido(at(2, 13), 100)]);
    expect(entry).toMatchObject({ stage: "creative", round: 1, outcome: "resent" });
    expect(entry.textBefore).toBeUndefined();
  });
});

describe("comparação de texto", () => {
  it("destaca só as palavras que mudaram", () => {
    expect(diffWords("Convite para o Boteco hoje", "Convite para o Buteco hoje")).toEqual([
      { type: "same", text: "Convite para o " },
      { type: "removed", text: "Boteco" },
      { type: "added", text: "Buteco" },
      { type: "same", text: " hoje" },
    ]);
  });

  it("lida com texto novo e texto apagado", () => {
    expect(diffWords("", "Oi")).toEqual([{ type: "added", text: "Oi" }]);
    expect(diffWords("Oi", "")).toEqual([{ type: "removed", text: "Oi" }]);
  });
});
