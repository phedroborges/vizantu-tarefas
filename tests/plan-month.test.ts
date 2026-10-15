import { describe, expect, it } from "vitest";
import { monthLabel, monthOfDate, monthlyPlanTitle, planDisplayName, targetMonth } from "../src/lib/plan-month";

describe("plano mensal", () => {
  it("lê o mês da data de entrega", () => {
    expect(monthOfDate("2026-10-23")).toBe("2026-10");
    expect(monthOfDate(null)).toBeNull();
    expect(monthOfDate("2026-13-01")).toBeNull();
  });

  it("nomeia o plano como a casa já faz e como o cliente lê", () => {
    expect(monthlyPlanTitle("Casa Caramelo", "2026-10")).toBe("Casa Caramelo | 10/26");
    expect(monthLabel("2026-10")).toBe("Outubro de 2026");
    expect(planDisplayName({ title: "Casa Caramelo | 10/26", periodMonth: "2026-10" })).toBe("Plano de Outubro de 2026");
    expect(planDisplayName({ title: "Campanha Black Friday", periodMonth: null })).toBe("Campanha Black Friday");
  });

  it("move o conteúdo de plano mensal para o mês da data", () => {
    expect(targetMonth({ kind: "tarefa", dueDate: "2026-11-03" }, { periodMonth: "2026-10" })).toBe("2026-11");
    expect(targetMonth({ kind: "tarefa", dueDate: "2026-10-03" }, { periodMonth: "2026-10" })).toBeNull();
  });

  it("nunca mexe em campanha, marca ou processo", () => {
    expect(targetMonth({ kind: "tarefa", dueDate: "2026-11-25" }, { periodMonth: null })).toBeNull();
    expect(targetMonth({ kind: "tarefa", dueDate: "2026-11-25" }, {})).toBeNull();
  });

  it("não decide nada sem data", () => {
    expect(targetMonth({ kind: "conteudo", dueDate: null }, { periodMonth: "2026-10" })).toBeNull();
    expect(targetMonth({ kind: "conteudo" })).toBeNull();
  });

  it("coloca conteúdo avulso com data no plano do mês, mas deixa tarefa comum em paz", () => {
    expect(targetMonth({ kind: "conteudo", dueDate: "2026-10-15" })).toBe("2026-10");
    expect(targetMonth({ kind: "tarefa", dueDate: "2026-10-15" })).toBeNull();
  });
});
