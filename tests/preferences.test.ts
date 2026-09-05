import { describe, expect, it } from "vitest";
import { defaultPreferences, mergePreferences, normalizePreferences, toggleColumn } from "../src/lib/preferences";

describe("preferências de exibição por pessoa", () => {
  it("sem nada salvo, cai no padrão da casa", () => {
    expect(normalizePreferences(null)).toEqual(defaultPreferences());
    expect(normalizePreferences("lixo")).toEqual(defaultPreferences());
    expect(normalizePreferences({})).toEqual(defaultPreferences());
  });

  it("guarda o jeito de ver de quem escolheu", () => {
    const saved = normalizePreferences({ taskView: "calendario", dateFormat: "relativo", showFinalized: true });
    expect(saved.taskView).toBe("calendario");
    expect(saved.showFinalized).toBe(true);
  });

  it("descarta valor inválido em vez de quebrar a tela", () => {
    const saved = normalizePreferences({ taskView: "kanban", dateFormat: "asteca", showFinalized: "sim" });
    expect(saved).toEqual(defaultPreferences());
  });

  it("ignora coluna que não existe mais, mantendo as boas", () => {
    const saved = normalizePreferences({ taskColumns: ["status", "coluna_aposentada", "assignee"] });
    expect(saved.taskColumns).toEqual(["status", "assignee"]);
  });

  it("desmarcar todas as colunas é escolha legítima, não erro", () => {
    expect(normalizePreferences({ taskColumns: [] }).taskColumns).toEqual([]);
  });

  it("PATCH parcial não apaga o que a pessoa já tinha escolhido", () => {
    const current = normalizePreferences({ taskView: "calendario", taskColumns: ["status"], showFinalized: true });
    const next = mergePreferences(current, { dateFormat: "relativo" });
    expect(next.taskView).toBe("calendario");
    expect(next.taskColumns).toEqual(["status"]);
    expect(next.showFinalized).toBe(true);
    expect(next.dateFormat).toBe("relativo");
  });

  it("chave desconhecida no corpo do PATCH não entra", () => {
    const next = mergePreferences(defaultPreferences(), { statusColors: { finalizado: "#000000" }, admin: true });
    expect(next).toEqual(defaultPreferences());
    expect(Object.keys(next).sort()).toEqual(["dateFormat", "showFinalized", "taskColumnWidths", "taskColumns", "taskFilters", "taskView"]);
  });

  // A largura de coluna já foi perdida em silêncio uma vez: mergePreferences
  // lista cada chave à mão, e quem esqueceu de listar a nova viu o arrasto
  // funcionar na tela e sumir ao soltar. Estes três travam isso.
  it("largura de coluna atravessa o merge", () => {
    const next = mergePreferences(defaultPreferences(), { taskColumnWidths: { name: 420, status: 210 } });
    expect(next.taskColumnWidths).toEqual({ name: 420, status: 210 });
  });

  it("largura de coluna sobrevive a um PATCH de outra preferência", () => {
    const current = normalizePreferences({ taskColumnWidths: { name: 420 } });
    expect(mergePreferences(current, { dateFormat: "relativo" }).taskColumnWidths).toEqual({ name: 420 });
  });

  it("largura absurda ou de coluna inexistente não passa", () => {
    const next = normalizePreferences({
      taskColumnWidths: { name: -4000, status: 99999, dueDate: "muito", inventada: 200, assignee: 180 },
    });
    // Presa entre 72 e 720; texto e coluna desconhecida somem.
    expect(next.taskColumnWidths).toEqual({ name: 72, status: 720, assignee: 180 });
  });

  it("liga e desliga coluna sem duplicar", () => {
    expect(toggleColumn(["status"], "assignee")).toEqual(["status", "assignee"]);
    expect(toggleColumn(["status", "assignee"], "status")).toEqual(["assignee"]);
  });

  it("salva os filtros usados pela pessoa", () => {
    const next = mergePreferences(defaultPreferences(), { taskFilters: { query: "urgente", projectId: "projeto-1", assigneeId: "membro-2", status: "atrasada", list: "criativa" } });
    expect(next.taskFilters).toEqual({ query: "urgente", projectId: "projeto-1", assigneeId: "membro-2", status: "atrasada", list: "criativa" });
  });

  it("filtro salvo sobrevive a PATCH de outra preferência", () => {
    const current = normalizePreferences({ taskFilters: { query: "", projectId: "cliente", assigneeId: "", status: "", list: "estrategica" } });
    expect(mergePreferences(current, { dateFormat: "relativo" }).taskFilters.projectId).toBe("cliente");
  });

  it("descarta lista inválida sem apagar os outros filtros", () => {
    const next = normalizePreferences({ taskFilters: { query: "x", projectId: "p", assigneeId: "m", status: "feito", list: "inventada" } });
    expect(next.taskFilters).toEqual({ query: "x", projectId: "p", assigneeId: "m", status: "feito", list: "" });
  });
});
