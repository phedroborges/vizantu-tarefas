import { derivedFields, parseFaixas } from "../contract-render";
import type { Contract, Tag, Task } from "../types";
import { CATEGORIES, type Entry, type EntryInput, type FinanceData, type Payment, type ProductionReview, type RateKey, type Settings } from "./types";

function localDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}
export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function money(value: string): number {
  const raw = value.trim().replace(/R\$|\s/g, "");
  if (!/^-?[\d.,]+$/.test(raw)) return NaN;
  const normalized = raw.includes(",") ? raw.replaceAll(".", "").replace(",", ".") : raw;
  const amount = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(amount) ? amount : NaN;
}
export function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
export function monthAdd(date: string, count: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + count, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + count, Math.min(d, last))).toISOString().slice(0, 10);
}
export function daysAdd(date: string, count: number, business = false): string {
  const value = new Date(`${date}T12:00:00Z`);
  for (let i = 0; i < count;) { value.setUTCDate(value.getUTCDate() + 1); if (!business || ![0, 6].includes(value.getUTCDay())) i++; }
  return value.toISOString().slice(0, 10);
}
export const paid = (entry: Entry, payments: Payment[], asOf = "9999-12-31") => payments.filter((p) => p.entryId === entry.id && !p.reversed && p.paidAt <= asOf).reduce((sum, p) => sum + p.amount, 0);
export const balance = (entry: Entry, payments: Payment[], asOf?: string) => entry.cancelled ? 0 : Math.max(0, entry.amount - paid(entry, payments, asOf));
const sum = (items: Entry[]) => items.reduce((total, entry) => total + entry.amount, 0);

export function recurringEntries(input: EntryInput, months: number): EntryInput[] {
  if (!Number.isInteger(months) || months < 1 || months > 120 || !validDate(input.dueDate) || !validDate(`${input.competence}-01`)) throw new Error("Informe datas válidas e um prazo de 1 a 120 meses.");
  return Array.from({ length: months }, (_, i) => ({ ...input, dueDate: monthAdd(input.dueDate, i), competence: monthAdd(`${input.competence}-01`, i).slice(0, 7), sourceKey: input.sourceKey ? `${input.sourceKey}:${i}` : null }));
}

export function contractEntries(contract: Contract): { entries: EntryInput[]; warning?: string } {
  if (contract.status !== "assinado") return { entries: [] };
  const f = contract.fields;
  const start = f.vigencia_inicio;
  const day = Number(f.dia_vencimento);
  const signature = f.data_assinatura;
  const amount = money(f.valor_mensal || "");
  const tiers = parseFaixas(f.faixas_pagamento || f.escalonamento || "");
  // Campos de escalonamento seguem os mesmos nomes do gerador do contrato.
  if (tiers.reduce((total, tier) => total + tier.meses, 0) > 120) return { entries: [], warning: `${contract.title}: o prazo máximo de importação é de 120 meses.` };
  const tierValues = tiers.flatMap((tier) => Array.from({ length: Math.min(tier.meses, 120) }, () => Math.round(tier.valor * 100)));
  const months = contract.paymentStructure === "escalonado" ? tierValues.length : Number(contract.paymentStructure === "projeto" ? f.parcelas || "1" : f.vigencia_meses);
  if (!contract.projectId || !validDate(start || "") || !validDate(signature || "") || !Number.isInteger(day) || day < 1 || day > 28 || !Number.isInteger(months) || months < 1 || months > 120 || (contract.paymentStructure !== "escalonado" && (!Number.isSafeInteger(amount) || amount <= 0))) {
    return { entries: [], warning: `${contract.title}: complete projeto, valor, assinatura, início, prazo e vencimento (1 a 28) no contrato.` };
  }
  const firstDue = `${monthAdd(start, contract.paymentMode === "pre" ? -1 : 0).slice(0, 7)}-${String(day).padStart(2, "0")}`;
  const projectTotal = contract.paymentStructure === "projeto" ? money(derivedFields(f, contract.paymentMode, contract.paymentStructure).valor_total_formatado || "") : amount;
  const values = contract.paymentStructure === "escalonado" ? tierValues : contract.paymentStructure === "projeto"
    ? Array.from({ length: months }, (_, i) => Math.floor(projectTotal / months) + (i < projectTotal % months ? 1 : 0))
    : Array.from({ length: months }, () => amount);
  return { entries: values.map((value, index) => ({
    direction: "income", category: contract.paymentStructure === "projeto" ? "campanha" : "servicos",
    description: `${contract.title} · ${index + 1}/${months}`, amount: value,
    dueDate: monthAdd(firstDue, index) < signature ? signature : monthAdd(firstDue, index),
    competence: monthAdd(start, index).slice(0, 7), projectId: contract.projectId!, memberId: null,
    recurring: contract.paymentStructure !== "projeto", seriesId: contract.id, sourceKey: `contract:${contract.id}:${index}`,
    notes: "Gerado do contrato assinado. Recebimento depende de baixa.",
  })) };
}

export function metrics(data: Pick<FinanceData, "entries" | "payments" | "settings">, month: string, today: string) {
  const { payments, settings } = data;
  const entries = data.entries.filter((entry) => !entry.cancelled);
  const current = entries.filter((entry) => entry.competence === month);
  const revenue = sum(current.filter((entry) => entry.direction === "income"));
  const expenses = current.filter((entry) => entry.direction === "expense");
  const costs = Object.fromEntries(Object.keys(CATEGORIES).map((key) => [key, sum(expenses.filter((entry) => entry.category === key))])) as Record<keyof typeof CATEGORIES, number>;
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const cashPayments = payments.filter((p) => !p.reversed && p.paidAt.startsWith(month) && entryById.has(p.entryId));
  const received = cashPayments.filter((p) => entryById.get(p.entryId)?.direction === "income").reduce((s, p) => s + p.amount, 0);
  const spent = cashPayments.filter((p) => entryById.get(p.entryId)?.direction === "expense").reduce((s, p) => s + p.amount, 0);
  const taxEstimate = settings.taxRate === null ? null : Math.round((settings.taxBasis === "cash" ? received : revenue) * settings.taxRate / 100);
  // Imposto cadastrado substitui a provisão estimada: nunca somar os dois.
  const tax = costs.impostos || taxEstimate;
  const directCost = costs.producao;
  const operatingCost = costs.operacional + costs.ferramentas + costs.marketing + costs.prolabore + costs.outros_custos;
  const grossProfit = tax === null ? null : revenue - tax - directCost;
  const profit = grossProfit === null ? null : grossProfit - operatingCost;
  const recurring = current.filter((entry) => entry.direction === "income" && entry.recurring);
  const clients = new Set(recurring.map((entry) => entry.projectId).filter(Boolean));
  const previous = monthAdd(`${month}-01`, -1).slice(0, 7);
  const priorRecurring = entries.filter((entry) => entry.competence === previous && entry.recurring && entry.direction === "income");
  const priorClients = new Set(priorRecurring.map((entry) => entry.projectId).filter(Boolean));
  const churned = [...priorClients].filter((id) => !clients.has(id));
  const churn = priorClients.size ? churned.length / priorClients.size : null;
  const mrr = sum(recurring);
  const arpa = clients.size ? mrr / clients.size : null;
  const margin = revenue && profit !== null ? profit / revenue : null;
  const grossMargin = revenue && grossProfit !== null ? grossProfit / revenue : null;
  const ltv = churn && arpa !== null && grossMargin !== null && grossMargin > 0 ? Math.round(arpa * grossMargin / churn) : null;
  const newClients = [...clients].filter((id) => !priorClients.has(id)).length;
  const cac = newClients ? Math.round(costs.marketing / newClients) : null;
  const cash = settings.openingBalance + payments.filter((p) => !p.reversed && p.paidAt >= settings.openingDate && p.paidAt <= today && entryById.has(p.entryId))
    .reduce((total, p) => total + (entryById.get(p.entryId)?.direction === "income" ? p.amount : -p.amount), 0);
  const overdue = entries.filter((e) => e.direction === "income" && e.dueDate < today && balance(e, payments, today) > 0);
  const aging = [0, 0, 0, 0];
  for (const entry of overdue) {
    const days = Math.floor((Date.parse(today) - Date.parse(entry.dueDate)) / 86400000);
    aging[days <= 7 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3] += balance(entry, payments, today);
  }
  const dueInMonth = entries.filter((entry) => entry.dueDate.startsWith(month));
  const receivable = dueInMonth.filter((e) => e.direction === "income").reduce((s, e) => s + balance(e, payments, today), 0);
  const payable = dueInMonth.filter((e) => e.direction === "expense").reduce((s, e) => s + balance(e, payments, today), 0);
  const monthlyClients = new Set(current.filter((e) => e.direction === "income").map((e) => e.projectId).filter(Boolean));
  const breakEven = grossMargin && grossMargin > 0 ? Math.round(operatingCost / grossMargin) : null;
  const historicalStart = monthAdd(`${month}-01`, -3).slice(0, 7);
  const history = Array.from({ length: 3 }, (_, i) => {
    const key = monthAdd(`${historicalStart}-01`, i).slice(0, 7);
    const rows = entries.filter((e) => e.competence === key);
    return { month: key, revenue: sum(rows.filter((e) => e.direction === "income")), cost: sum(rows.filter((e) => e.direction === "expense" && e.category !== "retiradas")), hasData: rows.length > 0 };
  });
  const observed = history.filter((h) => h.hasData);
  const averageRevenue = observed.length ? Math.round(observed.reduce((s, h) => s + h.revenue, 0) / observed.length) : null;
  const averageCost = observed.length ? Math.round(observed.reduce((s, h) => s + h.cost, 0) / observed.length) : null;
  const health = !current.length ? "Sem dados" : tax === null ? "Configuração incompleta" : cash < 0 || (profit !== null && profit < 0) ? "Crítica" : overdue.length || (margin !== null && margin * 100 < settings.targetMargin) ? "Atenção" : "Saudável";
  return { revenue, costs, tax, taxEstimate, directCost, operatingCost, grossProfit, profit, margin, received, spent, cash, receivable, payable,
    mrr, arr: mrr * 12, arpa, ticket: monthlyClients.size ? Math.round(sum(current.filter((e) => e.direction === "income" && e.projectId !== null)) / monthlyClients.size) : null,
    churn, ltv, cac, newClients, clients: clients.size, aging, overdue, breakEven, health, history, averageRevenue, averageCost,
    runway: averageCost && averageCost > 0 ? Math.max(0, cash / averageCost) : null };
}

export function growthProjection(base: number, cost: number, growth: number, churn: number, months: number) {
  let value = base;
  return Array.from({ length: months }, (_, i) => { value = Math.round(value * (1 + growth / 100) * (1 - churn / 100)); return { period: i + 1, revenue: value, cost, result: value - cost }; });
}
export function priceSuggestion(cost: number, tax: number | null, margin: number, score: number | null, promoterPremium = 5) {
  if (tax === null || !Number.isFinite(cost) || cost <= 0 || tax + margin >= 100) return null;
  const floor = Math.ceil(cost / (1 - (tax + margin) / 100));
  return { floor, suggested: Math.ceil(floor * (score !== null && score >= 9 ? 1 + promoterPremium / 100 : 1)), note: score === null ? "Sem avaliação: preço por custo e margem." : score <= 6 ? "Priorize corrigir a experiência antes de reajustar." : "Simulação comercial; não altera o contrato." };
}

export type ProductionLine = { taskId: string; name: string; projectId: string; memberId?: string; rateKey: RateKey | null; package: boolean; cards: number; dueDate: string; deliveredDate: string | null; late: boolean; qualityProblem: boolean; base: number; total: number; penalty: boolean; ready: boolean };
export function productionLines(tasks: Task[], tags: Tag[], reviews: ProductionReview[], settings: Settings): ProductionLine[] {
  const labels = new Map(tags.map((tag) => [tag.id, tag.label]));
  const reviewById = new Map(reviews.map((review) => [review.taskId, review]));
  const rows = tasks.map((task) => {
    const review = reviewById.get(task.id);
    const format = [...task.formatTagIds.map((id) => labels.get(id) || ""), task.name].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const rateKey: RateKey | null = review?.rateKey || (/manual.*marca/.test(format) ? "manual" : /canva|apresentacao/.test(format) ? "canva" : /carross/.test(format) ? "carrossel" : /reels?|video/.test(format) ? "reels" : /estatico|feed|story/.test(format) ? "estatico" : null);
    const deliveryEvent = task.statusHistory.find((event) => ["para_aprovacao", "aprovado", "finalizado"].includes(event.status));
    const delivered = review?.deliveredDate || (deliveryEvent ? localDate(deliveryEvent.enteredAt) : null);
    const dueDate = daysAdd(localDate(task.createdAt), task.captacaoId ? settings.packageDays : settings.soloDays, settings.deadlineMode === "business");
    const late = Boolean(delivered && delivered > dueDate);
    const qualityProblem = review?.qualityProblem || false;
    return { taskId: task.id, name: task.name, projectId: task.projectId, memberId: task.assigneeId, rateKey, package: Boolean(task.captacaoId), cards: review?.cards ?? 8, dueDate, deliveredDate: delivered,
      late, qualityProblem, base: 0, total: 0, penalty: settings.penaltyMode === "both" ? late && qualityProblem : late || qualityProblem, ready: Boolean(delivered && rateKey && task.assigneeId),
      group: `${task.projectId}:${task.captacaoId || task.id}:${task.assigneeId}:${rateKey}` };
  });
  const groups = new Map<string, typeof rows>();
  for (const row of rows) { const group = groups.get(row.group) || []; group.push(row); groups.set(row.group, group); }
  for (const group of groups.values()) group.sort((a, b) => a.taskId.localeCompare(b.taskId));
  for (const row of rows) {
    if (!row.rateKey) continue;
    const rate = settings.rates[row.rateKey];
    const group = groups.get(row.group)!;
    const rank = group.indexOf(row);
    const discountedCount = Math.floor(group.length / 5) * 5;
    row.base = row.package && rate.pack !== null && rank < discountedCount ? Math.floor(rate.pack / 5) + (rank % 5 < rate.pack % 5 ? 1 : 0) : rate.unit;
    if (row.rateKey === "carrossel") row.base += Math.max(0, row.cards - 8) * settings.extraCard;
    row.total = Math.round(row.base * (row.penalty ? 0.5 : 1));
  }
  return rows;
}
