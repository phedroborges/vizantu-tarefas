import { describe, expect, it } from "vitest";
import { NO_FORMAT_KEY, comparePriority, groupByFormat, inQueueScope, planProgress, queueSummary } from "../src/lib/plan-queue";
import type { Task } from "../src/lib/types";

const TODAY = "2026-10-09";
const formats = [{ id: "video", label: "Vídeos" }, { id: "carrossel", label: "Carrosséis" }, { id: "estatico", label: "Estáticos" }];

function task(id: string, input: Partial<Task> = {}): Task {
  return {
    id, name: id, projectId: "p1", kind: "conteudo", images: [], formatTagIds: ["video"], channelTagIds: [], categoryTagIds: [], lists: ["criativa"],
    status: "pronto_para_criacao", statusHistory: [], comments: [], createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", ...input,
  };
}

describe("fila de demandas do cliente", () => {
  it("ordena pela urgência: mais atrasada, prazo mais próximo, etapa mais adiantada", () => {
    const tasks = [
      task("sem prazo"),
      task("vence amanhã", { dueDate: "2026-10-10" }),
      task("atrasada 2 dias", { dueDate: "2026-10-07" }),
      task("atrasada 8 dias", { dueDate: "2026-10-01" }),
      task("vence amanhã, em ajuste", { dueDate: "2026-10-10", status: "ajuste" }),
    ];
    expect(tasks.sort((a, b) => comparePriority(a, b, TODAY)).map((item) => item.id))
      .toEqual(["atrasada 8 dias", "atrasada 2 dias", "vence amanhã, em ajuste", "vence amanhã", "sem prazo"]);
  });

  it("separa por formato na ordem cadastrada e esconde grupo vazio", () => {
    const groups = groupByFormat([
      task("estatico 1", { formatTagIds: ["estatico"] }),
      task("video tarde", { dueDate: "2026-10-20" }),
      task("video atrasado", { dueDate: "2026-10-02" }),
      task("sem formato", { formatTagIds: [] }),
      task("formato apagado", { formatTagIds: ["sumiu"] }),
    ], formats, TODAY);
    expect(groups.map((group) => [group.label, group.tasks.map((item) => item.id), group.late])).toEqual([
      ["Vídeos", ["video atrasado", "video tarde"], 1],
      ["Estáticos", ["estatico 1"], 0],
      ["Sem formato", ["formato apagado", "sem formato"], 0],
    ]);
    expect(groups.at(-1)?.key).toBe(NO_FORMAT_KEY);
  });

  it("“para criar” é só o que está na mão de quem cria", () => {
    expect(["pronto_para_criacao", "em_criacao", "revisao", "ajuste"].every((status) => inQueueScope(status as Task["status"], "criar"))).toBe(true);
    expect(inQueueScope("rascunho", "criar")).toBe(false);
    expect(inQueueScope("para_aprovacao", "criar")).toBe(false);
    expect(inQueueScope("para_aprovacao", "abertas")).toBe(true);
    expect(inQueueScope("finalizado", "abertas")).toBe(false);
    expect(inQueueScope("problema", "abertas")).toBe(false);
    expect(inQueueScope("finalizado", "concluidas")).toBe(true);
  });

  it("resume o cliente e diz quando o plano terminou", () => {
    const tasks = [task("a", { dueDate: "2026-10-01" }), task("b", { status: "rascunho" }), task("c", { status: "finalizado" }), task("d", { status: "problema" })];
    expect(queueSummary(tasks, TODAY)).toEqual({ toCreate: 1, open: 2, late: 1 });
    expect(planProgress(tasks)).toEqual({ total: 4, done: 1, open: 2, finished: false });
    expect(planProgress([task("c", { status: "finalizado" }), task("d", { status: "problema" })])).toMatchObject({ finished: true });
    // Plano vazio acabou de ser criado: não é "finalizado".
    expect(planProgress([]).finished).toBe(false);
  });
});
