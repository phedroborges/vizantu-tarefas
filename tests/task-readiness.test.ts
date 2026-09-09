import { describe, expect, it } from "vitest";
import { findTaskGaps, type TaskReadinessInput } from "../src/lib/task-readiness";
import type { Tag } from "../src/lib/types";

const tags: Tag[] = [
  { id: "formato", kind: "formato", label: "Reels", createdAt: "2026-09-01T00:00:00.000Z" },
  { id: "canal", kind: "canal", label: "Instagram", createdAt: "2026-09-01T00:00:00.000Z" },
];

function input(overrides: Partial<TaskReadinessInput> = {}): TaskReadinessInput {
  return {
    status: "em_criacao", kind: "conteudo", driveLink: "https://drive.test/arquivo",
    assigneeId: "m1", dueDate: "2026-09-10", formatTagIds: ["formato"], channelTagIds: ["canal"],
    ...overrides,
  };
}

const types = (task: TaskReadinessInput) => findTaskGaps(task, tags).map((gap) => gap.type);

describe("pendências da tarefa", () => {
  it("não acusa nada quando a tarefa está completa", () => {
    expect(findTaskGaps(input(), tags)).toEqual([]);
  });

  it("cobra o link enquanto a demanda está na fila criativa", () => {
    expect(types(input({ status: "pronto_para_criacao", driveLink: "" }))).toContain("link");
    expect(types(input({ status: "ajuste", driveLink: undefined }))).toContain("link");
    expect(types(input({ status: "rascunho", driveLink: "" }))).not.toContain("link");
  });

  it("trata como crítico o link que falta na hora de mandar para aprovação", () => {
    const gap = findTaskGaps(input({ status: "para_aprovacao", driveLink: "  " }), tags).find((item) => item.type === "link")!;
    expect(gap.critical).toBe(true);
    expect(gap.message).toContain("Para aprovação");
    expect(findTaskGaps(input({ status: "em_criacao", driveLink: "" }), tags)[0].critical).toBe(false);
  });

  it("cala a boca na tarefa finalizada", () => {
    expect(findTaskGaps(input({ status: "finalizado", driveLink: "", assigneeId: undefined, dueDate: undefined }), tags)).toEqual([]);
  });

  it("só cobra formato e canal de conteúdo", () => {
    expect(types(input({ formatTagIds: [], channelTagIds: [] }))).toEqual(["formato", "canal"]);
    expect(types(input({ kind: "tarefa", formatTagIds: [], channelTagIds: [] }))).toEqual([]);
  });

  it("cobra responsável e prazo em qualquer tipo", () => {
    expect(types(input({ kind: "tarefa", assigneeId: undefined, dueDate: "" }))).toEqual(["responsavel", "prazo"]);
  });

  // Sem o catálogo (é o caso da lista de tarefas, que não carrega as etiquetas)
  // a etiqueta marcada precisa valer — senão a lista acusaria falta de formato
  // em tarefa que tem formato.
  it("aceita a etiqueta marcada quando o catálogo não veio junto", () => {
    expect(findTaskGaps(input({ formatTagIds: ["x"], channelTagIds: ["y"] }))).toEqual([]);
    expect(findTaskGaps(input({ formatTagIds: [], channelTagIds: [] })).map((gap) => gap.type)).toEqual(["formato", "canal"]);
  });
});
