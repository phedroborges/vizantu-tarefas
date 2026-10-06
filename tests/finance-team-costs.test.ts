import { describe, expect, it } from "vitest";
import { clientMargins, compensationFor, metrics, productionLines, teamClosingsFromLines } from "../src/lib/finance/calculations";
import { financeFixture } from "../src/app/design-system/financeiro-check/mock";
import type { Entry, FinanceData } from "../src/lib/finance/types";

const sample = () => ({ ...structuredClone(financeFixture), entries: [] as Entry[] });
const expense = (data: FinanceData, sourceKey: string | null, amount: number, patch: Partial<Entry> = {}): Entry => ({ id: "expense", direction: "expense", category: "producao", description: "Equipe", amount, competence: "2026-09", projectId: null, memberId: data.members[0].id, recurring: false, seriesId: null, sourceKey, cancelled: false, notes: "", createdAt: "2026-09-01", ...patch });
const closing = (data: FinanceData, month = "2026-09") => teamClosingsFromLines(productionLines(data.tasks, data.tags, data.settings, data.members), data.entries, data.members, data.settings, month)[0];

describe("custo da equipe e remuneração", () => {
  it("conta demandas antes do lançamento e substitui cada estimativa pelo valor registrado", () => {
    const data = sample();
    expect(metrics(data, "2026-09")).toMatchObject({ directCost: 28000, teamPending: 28000, profit: -28000, health: "Crítica" });
    data.entries.push(expense(data, "production:task-0", 12345));
    expect(metrics(data, "2026-09")).toMatchObject({ directCost: 34745, teamPending: 22400 });
    expect(closing(data)).toMatchObject({ launched: 12345, pending: 22400, total: 34745 });
  });
  it("não recria a estimativa de uma despesa de produção cancelada", () => {
    const data = sample(); data.entries.push(expense(data, "production:task-0", 5600, { cancelled: true }));
    expect(metrics(data, "2026-09")).toMatchObject({ directCost: 22400, teamPending: 22400 });
    expect(closing(data).cancelledTaskIds).toContain("task-0");
  });
  it("salário entra uma vez por mês mesmo sem tarefas e não soma pagamentos por peça", () => {
    const data = sample();
    data.settings.compensationRules = [{ memberId: data.members[0].id, fromMonth: "2026-09", mode: "salary", salary: 180000 }];
    expect(metrics(data, "2026-09").directCost).toBe(180000);
    expect(closing(data)).toMatchObject({ paymentMode: "salary", pieces: 5, pending: 180000, unpriced: 0 });
    data.tasks = [];
    expect(metrics(data, "2026-09").directCost).toBe(180000);
    data.entries.push(expense(data, `salary:${data.members[0].id}:2026-09`, 175000));
    expect(metrics(data, "2026-09")).toMatchObject({ directCost: 175000, teamPending: 0 });
    data.settings.compensationRules[0].salary = 200000;
    expect(metrics(data, "2026-09").directCost).toBe(175000);
  });
  it("usa despesas manuais associadas à pessoa para abater o salário a lançar", () => {
    const data = sample(); data.settings.compensationRules = [{ memberId: data.members[0].id, fromMonth: "2026-09", mode: "salary", salary: 180000 }];
    data.entries.push(expense(data, "manual:old:0", 150000));
    expect(metrics(data, "2026-09")).toMatchObject({ directCost: 180000, teamPending: 30000 });
  });
  it("respeita o mês de vigência e permite interromper o salário", () => {
    const data = sample(); data.settings.compensationRules = [
      { memberId: data.members[0].id, fromMonth: "2026-10", mode: "salary", salary: 180000 },
      { memberId: data.members[0].id, fromMonth: "2026-11", mode: "none", salary: 0 },
    ];
    expect(compensationFor(data.settings, data.members[0], "2026-09").mode).toBe("demand");
    expect(metrics(data, "2026-09").directCost).toBe(28000);
    expect(metrics(data, "2026-10").directCost).toBe(180000);
    expect(metrics(data, "2026-11").directCost).toBe(0);
  });
  it("permite social media receber por demanda ou salário, mantendo o padrão antigo sem custo implícito", () => {
    const data = sample(); data.members[0].role = "social_media";
    expect(metrics(data, "2026-09").directCost).toBe(0);
    data.settings.compensationRules = [{ memberId: data.members[0].id, fromMonth: "2026-09", mode: "demand", salary: 0 }];
    expect(metrics(data, "2026-09").directCost).toBe(28000);
    data.settings.compensationRules[0] = { ...data.settings.compensationRules[0], mode: "salary", salary: 200000 };
    expect(metrics(data, "2026-09").directCost).toBe(200000);
  });
  it("atribui demanda ao cliente e rateia salário pela receita sem duplicar após o lançamento", () => {
    const data = sample();
    data.entries = structuredClone(financeFixture.entries).filter((entry) => entry.direction === "income" && entry.competence === "2026-09");
    expect(clientMargins(data, "2026-09").reduce((total, row) => total + row.production, 0)).toBe(28000);
    data.settings.compensationRules = [{ memberId: data.members[0].id, fromMonth: "2026-09", mode: "salary", salary: 180000 }];
    const before = clientMargins(data, "2026-09").map((row) => row.production);
    expect(before.reduce((total, amount) => total + amount, 0)).toBe(180000);
    data.entries.push(expense(data, `salary:${data.members[0].id}:2026-09`, 180000));
    expect(clientMargins(data, "2026-09").map((row) => row.production)).toEqual(before);
  });
  it("soma imposto e multa, e usa o total real em vez da estimativa", () => {
    const data = sample(); data.tasks = [];
    data.entries.push(expense(data, null, 90000, { category: "impostos" }), expense(data, null, 15000, { id: "fine", category: "impostos" }));
    expect(metrics(data, "2026-09")).toMatchObject({ tax: 105000, profit: -105000 });
    data.entries[0].amount = 95000;
    expect(metrics(data, "2026-09").tax).toBe(110000);
  });
});
