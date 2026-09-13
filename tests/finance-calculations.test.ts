import { describe, expect, it } from "vitest";
import { balance, contractEntries, growthProjection, metrics, monthAdd, productionLines, priceSuggestion, recurringEntries, validDate } from "../src/lib/finance/calculations";
import { DEFAULT_SETTINGS, type Entry, type Payment } from "../src/lib/finance/types";
import type { Contract, Task } from "../src/lib/types";
const entry = (patch: Partial<Entry> = {}): Entry => ({ id: "e1", direction: "income", category: "servicos", description: "Mensalidade", amount: 100000, dueDate: "2026-09-10", competence: "2026-09", projectId: "p1", memberId: null, recurring: true, seriesId: "s1", sourceKey: null, cancelled: false, notes: "", createdAt: "2026-09-01", ...patch });
const payment = (patch: Partial<Payment> = {}): Payment => ({ id: "payment", entryId: "e1", amount: 50000, paidAt: "2026-09-10", method: "Pix", reference: "", reversed: false, ...patch });
const contract = (patch: Partial<Contract> = {}): Contract => ({ id: "contract", projectId: "p1", title: "Gestão", templateId: "gestao_marca", paymentMode: "pre", paymentStructure: "mensal", status: "assinado", fields: { valor_mensal: "2.000,00", vigencia_inicio: "2026-09-01", vigencia_meses: "3", dia_vencimento: "10", data_assinatura: "2026-08-20" }, body: "", createdAt: "", updatedAt: "", ...patch });
const base = { entries: [], payments: [], settings: { ...DEFAULT_SETTINGS, taxRate: 10 } };
function task(i: number, patch: Partial<Task> = {}): Task { return { id: `t${i}`, projectId: "p1", name: "Reels", kind: "conteudo", createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z", status: "aprovado", statusHistory: [{ status: "para_aprovacao", enteredAt: "2026-09-04T12:00:00Z", exitedAt: null }], images: [], formatTagIds: [], channelTagIds: [], categoryTagIds: [], lists: [], comments: [], assigneeId: "member", captacaoId: "cap", ...patch }; }

describe("contratos e recorrência", () => {
  it("gera parcelas finitas, com a primeira nunca anterior à assinatura", () => {
    const result = contractEntries(contract());
    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((e) => e.dueDate)).toEqual(["2026-08-20", "2026-09-10", "2026-10-10"]);
    expect(result.entries.map((e) => e.competence)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(new Set(result.entries.map((e) => e.sourceKey)).size).toBe(3);
  });
  it("não importa rascunhos ou contratos incompletos", () => {
    expect(contractEntries(contract({ status: "rascunho" })).entries).toHaveLength(0);
    expect(contractEntries(contract({ fields: {} })).warning).toContain("complete");
  });
  it("importa escalonamento sem achatar os valores", () => {
    const c = contract(); c.paymentStructure = "escalonado"; c.fields.escalonamento = "2 x 1000\n1 x 1500";
    expect(contractEntries(c).entries.map((e) => e.amount)).toEqual([100000,100000,150000]);
  });
  it("parcelamento de projeto conserva centavos e não entra no MRR", () => {
    const c = contract(); c.paymentStructure = "projeto"; c.fields = { ...c.fields, valor_mensal: "100,01", vigencia_meses: "1", parcelas: "3" };
    const result = contractEntries(c).entries;
    expect(result.map((e) => e.amount)).toEqual([3334,3334,3333]); expect(result.every((e) => !e.recurring)).toBe(true);
  });
  it("recorrência iniciada em 31 respeita fevereiro e recupera o dia no mês seguinte", () => {
    expect(recurringEntries({ ...entry(), dueDate: "2026-01-31", competence: "2026-01" }, 3).map((e) => e.dueDate)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(monthAdd("2024-01-31",1)).toBe("2024-02-29"); expect(validDate("2026-02-31")).toBe(false);
  });
});
describe("DRE, caixa e indicadores", () => {
  it("separa competência, recebimento, retiradas e pró-labore", () => {
    const data = { ...base, entries: [entry(), entry({ id: "pro", direction: "expense", category: "prolabore", amount: 20000 }), entry({ id: "ret", direction: "expense", category: "retiradas", amount: 10000 })], payments: [payment(), payment({ entryId: "ret", amount: 10000 })] };
    const result = metrics(data, "2026-09", "2026-09-13");
    expect(result.revenue).toBe(100000); expect(result.received).toBe(50000); expect(result.tax).toBe(10000); expect(result.profit).toBe(70000); expect(result.cash).toBe(40000); expect(result.receivable).toBe(50000);
  });
  it("imposto real substitui a estimativa", () => {
    const result = metrics({ ...base, entries: [entry(), entry({ id: "tax", direction: "expense", category: "impostos", amount: 6000 })] }, "2026-09", "2026-09-13");
    expect(result.tax).toBe(6000); expect(result.profit).toBe(94000);
  });
  it("não inventa imposto ou LTV quando falta configuração ou churn", () => {
    const result = metrics({ ...base, settings: DEFAULT_SETTINGS, entries: [entry()] }, "2026-09", "2026-09-13");
    expect(result.tax).toBeNull(); expect(result.profit).toBeNull(); expect(result.ltv).toBeNull(); expect(result.health).toBe("Configuração incompleta");
  });
  it("exclui campanhas do MRR, cancelamentos e estornos do caixa", () => {
    const result = metrics({ ...base, entries: [entry(), entry({ id: "ad", recurring: false, category: "campanha", amount: 30000 }), entry({ id: "gone", cancelled: true })], payments: [payment({ reversed: true })] }, "2026-09", "2026-09-13");
    expect(result.mrr).toBe(100000); expect(result.revenue).toBe(130000); expect(result.cash).toBe(0);
  });
  it("não trata meses sem registros como meses com receita zero", () => { expect(metrics({ ...base, entries: [entry({ competence: "2026-08" })] }, "2026-09", "2026-09-13").averageRevenue).toBe(100000); });
  it("baixa parcial e estorno mantêm saldo correto", () => { expect(balance(entry(), [payment()])).toBe(50000); expect(balance(entry(), [payment({ reversed: true })])).toBe(100000); });
});
describe("produção e precificação", () => {
  it("pacote de cinco reels custa 280, e seis custam 350", () => {
    expect(productionLines(Array.from({ length: 5 }, (_, i) => task(i)), [], [], DEFAULT_SETTINGS).reduce((s, r) => s+r.total,0)).toBe(28000);
    expect(productionLines(Array.from({ length: 6 }, (_, i) => task(i)), [], [], DEFAULT_SETTINGS).reduce((s, r) => s+r.total,0)).toBe(35000);
  });
  it("não mistura pacotes de responsáveis diferentes", () => {
    const lines = productionLines(Array.from({ length: 5 }, (_, i) => task(i, { assigneeId: i < 3 ? "a" : "b" })), [], [], DEFAULT_SETTINGS);
    expect(lines.reduce((s,r)=>s+r.total,0)).toBe(35000);
  });
  it("cobra cards adicionais e só reduz com atraso E problema", () => {
    const t = task(1,{ captacaoId: undefined, name: "Carrossel" });
    const review = { taskId: t.id, rateKey: "carrossel" as const, cards: 10, deliveredDate: "2026-09-04", qualityProblem: true, notes: "" };
    const [line] = productionLines([t],[],[review],DEFAULT_SETTINGS);
    expect(line.base).toBe(14000); expect(line.total).toBe(7000);
    expect(productionLines([t],[],[{ ...review, qualityProblem:false }],DEFAULT_SETTINGS)[0].total).toBe(14000);
  });
  it("dias úteis pulam fim de semana", () => {
    const [line] = productionLines([task(1,{ createdAt:"2026-09-11T12:00:00Z", captacaoId:undefined })],[],[],{ ...DEFAULT_SETTINGS, deadlineMode:"business" });
    expect(line.dueDate).toBe("2026-09-14");
  });
  it("não gera produção pagável sem data de entrega", () => { expect(productionLines([task(1,{ statusHistory:[] })],[],[],DEFAULT_SETTINGS)[0].ready).toBe(false); });
  it("preço respeita custo, imposto e margem; NPS não reduz abaixo do piso", () => {
    expect(priceSuggestion(60000,10,30,10)).toMatchObject({ floor:100000,suggested:105000 });
    expect(priceSuggestion(60000,10,30,3)?.suggested).toBe(100000); expect(priceSuggestion(60000,null,30,10)).toBeNull();
  });
  it("crescimento é composto e desconta churn", () => { expect(growthProjection(100000,50000,10,0,2).map((r)=>r.revenue)).toEqual([110000,121000]); });
});
