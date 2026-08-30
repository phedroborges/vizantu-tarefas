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
    expect(Object.keys(next).sort()).toEqual(["dateFormat", "showFinalized", "taskColumns", "taskView"]);
  });

  it("liga e desliga coluna sem duplicar", () => {
    expect(toggleColumn(["status"], "assignee")).toEqual(["status", "assignee"]);
    expect(toggleColumn(["status", "assignee"], "status")).toEqual(["assignee"]);
  });
});
