import { derivedFields, parseFaixas } from "../contract-render";
import type { Contract, Member, Project, Tag, Task } from "../types";
import { CARGOS_QUE_PRODUZEM, CATEGORIES, type ClientMargin, type ContractSummary, type Entry, type EntryInput, type FinanceData, type ProductionReview, type RateKey, type Settings } from "./types";

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
const sum = (items: Entry[]) => items.reduce((total, entry) => total + entry.amount, 0);

export function recurringEntries(input: EntryInput, months: number): EntryInput[] {
  if (!Number.isInteger(months) || months < 1 || months > 120 || !validDate(`${input.competence}-01`)) throw new Error("Informe uma competência válida e um prazo de 1 a 120 meses.");
  return Array.from({ length: months }, (_, i) => ({ ...input, competence: monthAdd(`${input.competence}-01`, i).slice(0, 7), sourceKey: input.sourceKey ? `${input.sourceKey}:${i}` : null }));
}

export function contractEntries(contract: Contract, settings?: Pick<Settings, "annualAdjustment">): { entries: EntryInput[]; warning?: string } {
  if (contract.status !== "assinado") return { entries: [] };
  const f = contract.fields;
  const start = f.vigencia_inicio;
  const amount = money(f.valor_mensal || "");
  const tiers = parseFaixas(f.faixas_pagamento || f.escalonamento || "");
  // Campos de escalonamento seguem os mesmos nomes do gerador do contrato.
  if (tiers.reduce((total, tier) => total + tier.meses, 0) > 120) return { entries: [], warning: `${contract.title}: o prazo máximo de importação é de 120 meses.` };
  const tierValues = tiers.flatMap((tier) => Array.from({ length: Math.min(tier.meses, 120) }, () => Math.round(tier.valor * 100)));
  const months = contract.paymentStructure === "escalonado" ? tierValues.length : Number(contract.paymentStructure === "projeto" ? f.parcelas || "1" : f.vigencia_meses);
  if (!contract.projectId || !validDate(start || "") || !Number.isInteger(months) || months < 1 || months > 120 || (contract.paymentStructure !== "escalonado" && (!Number.isSafeInteger(amount) || amount <= 0))) {
    return { entries: [], warning: `${contract.title}: complete projeto, valor, início e prazo no contrato.` };
  }
  const projectTotal = contract.paymentStructure === "projeto" ? money(derivedFields(f, contract.paymentMode, contract.paymentStructure).valor_total_formatado || "") : amount;
  // O reajuste anual só toca a recorrência de valor fixo. Escalonado já traz os
  // valores escritos no contrato, e projeto é parcela de um total fechado —
  // reajustar qualquer um dos dois seria cobrar diferente do que foi assinado.
  const adjust = (value: number, index: number) => Math.round(value * (1 + (settings?.annualAdjustment || 0) / 100) ** Math.floor(index / 12));
  const values = contract.paymentStructure === "escalonado" ? tierValues : contract.paymentStructure === "projeto"
    ? Array.from({ length: months }, (_, i) => Math.floor(projectTotal / months) + (i < projectTotal % months ? 1 : 0))
    : Array.from({ length: months }, (_, i) => adjust(amount, i));
  return { entries: values.map((value, index) => ({
    direction: "income", category: contract.paymentStructure === "projeto" ? "campanha" : "servicos",
    description: `${contract.title} · ${index + 1}/${months}`, amount: value,
    competence: monthAdd(start, index).slice(0, 7), projectId: contract.projectId!, memberId: null,
    recurring: contract.paymentStructure !== "projeto", seriesId: contract.id, sourceKey: `contract:${contract.id}:${index}`,
    notes: "Gerado do contrato assinado.",
  })) };
}

export function metrics(data: Pick<FinanceData, "entries" | "settings">, month: string) {
  const { settings } = data;
  const entries = data.entries.filter((entry) => !entry.cancelled);
  const current = entries.filter((entry) => entry.competence === month);
  const revenue = sum(current.filter((entry) => entry.direction === "income"));
  const expenses = current.filter((entry) => entry.direction === "expense");
  const costs = Object.fromEntries(Object.keys(CATEGORIES).map((key) => [key, sum(expenses.filter((entry) => entry.category === key))])) as Record<keyof typeof CATEGORIES, number>;
  const taxEstimate = settings.taxRate === null ? null : Math.round(revenue * settings.taxRate / 100);
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
  // Saúde sem caixa: sobra resultado e margem, que é o que a competência sabe.
  const health = !current.length ? "Sem dados" : tax === null ? "Configuração incompleta" : profit !== null && profit < 0 ? "Crítica" : margin !== null && margin * 100 < settings.targetMargin ? "Atenção" : "Saudável";
  return { revenue, costs, tax, taxEstimate, directCost, operatingCost, grossProfit, profit, margin,
    mrr, arr: mrr * 12, arpa, ticket: monthlyClients.size ? Math.round(sum(current.filter((e) => e.direction === "income" && e.projectId !== null)) / monthlyClients.size) : null,
    churn, ltv, cac, newClients, clients: clients.size, breakEven, health, history, averageRevenue, averageCost };
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

// ---------- Quem recebe pela tarefa ----------
//
// Uma peça passa por várias mãos e só pode gerar um pagamento. A regra do dono é
// "o que mais trabalhou", e o app tem como responder isso sem chutar: toda troca
// de responsável fica registrada na atividade da tarefa, com valor antigo, novo
// e hora. Dá para remontar a linha do tempo e somar quanto tempo cada pessoa
// segurou a tarefa até a entrega.
//
// Só entram os cargos que produzem peça. Social media e dono aparecem na linha
// do tempo como qualquer outro, e são ignorados aqui de propósito: o trabalho
// deles não é medido em peça entregue.
export function assignmentSegments(task: Task, endAt: number): { memberId: string | null; from: number; to: number }[] {
  const changes = task.comments
    .filter((comment) => comment.kind === "activity" && comment.fieldKey === "assigneeId")
    .map((comment) => ({ at: Date.parse(comment.createdAt), para: (comment.newValue ?? null) as string | null, de: (comment.oldValue ?? null) as string | null }))
    .filter((change) => Number.isFinite(change.at))
    .sort((a, b) => a.at - b.at);
  // Sem nenhuma troca registrada, quem está com a tarefa hoje é quem sempre
  // esteve. Com trocas, o primeiro "valor antigo" é quem começou com ela.
  let holder = changes.length ? changes[0].de : task.assigneeId ?? null;
  let since = Date.parse(task.createdAt);
  const segments: { memberId: string | null; from: number; to: number }[] = [];
  for (const change of changes) {
    segments.push({ memberId: holder, from: since, to: change.at });
    holder = change.para;
    since = change.at;
  }
  segments.push({ memberId: holder, from: since, to: endAt });
  return segments;
}

export function creditedProducer(task: Task, eligible: Set<string>, endAt: number): string | null {
  const held = new Map<string, number>();
  let ultimo: string | null = null;
  for (const segment of assignmentSegments(task, endAt)) {
    const to = Math.min(segment.to, endAt);
    if (!segment.memberId || !eligible.has(segment.memberId) || to <= segment.from) continue;
    held.set(segment.memberId, (held.get(segment.memberId) ?? 0) + (to - segment.from));
    ultimo = segment.memberId;
  }
  if (!held.size) return null;
  const maior = Math.max(...held.values());
  const empatados = [...held.entries()].filter(([, tempo]) => tempo === maior).map(([id]) => id);
  // Empate desempata em quem estava com a tarefa no fim: quem finalizou leva.
  if (empatados.length === 1) return empatados[0];
  return ultimo && empatados.includes(ultimo) ? ultimo : [...empatados].sort()[0];
}

export type ProductionLine = { taskId: string; name: string; projectId: string; memberId?: string; producerId: string | null; rateKey: RateKey | null; package: boolean; cards: number; dueDate: string; deliveredDate: string | null; late: boolean; qualityProblem: boolean; base: number; total: number; penalty: boolean; ready: boolean; pendencia: string | null };

export function productionLines(tasks: Task[], tags: Tag[], reviews: ProductionReview[], settings: Settings, members: Member[]): ProductionLine[] {
  const labels = new Map(tags.map((tag) => [tag.id, tag.label]));
  const reviewById = new Map(reviews.map((review) => [review.taskId, review]));
  const produzem = new Set(members.filter((member) => (CARGOS_QUE_PRODUZEM as readonly string[]).includes(member.role)).map((member) => member.id));
  const rows = tasks.map((task) => {
    const review = reviewById.get(task.id);
    const format = [...task.formatTagIds.map((id) => labels.get(id) || ""), task.name].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const rateKey: RateKey | null = review?.rateKey || (/manual.*marca/.test(format) ? "manual" : /canva|apresentacao/.test(format) ? "canva" : /carross/.test(format) ? "carrossel" : /reels?|video/.test(format) ? "reels" : /estatico|feed|story/.test(format) ? "estatico" : null);
    const deliveryEvent = task.statusHistory.find((event) => ["para_aprovacao", "aprovado", "finalizado"].includes(event.status));
    const delivered = review?.deliveredDate || (deliveryEvent ? localDate(deliveryEvent.enteredAt) : null);
    const fim = deliveryEvent ? Date.parse(deliveryEvent.enteredAt) : Date.now();
    const producerId = creditedProducer(task, produzem, fim);
    const dueDate = daysAdd(localDate(task.createdAt), task.captacaoId ? settings.packageDays : settings.soloDays, settings.deadlineMode === "business");
    const late = Boolean(delivered && delivered > dueDate);
    const qualityProblem = review?.qualityProblem || false;
    const pendencia = !rateKey ? "Sem formato reconhecido: confira o tipo da peça."
      : !delivered ? "Sem evidência de entrega: a tarefa ainda não passou por aprovação."
      : !producerId ? "Sem diretor criativo na tarefa: ninguém que produz peça foi responsável por ela."
      : null;
    return { taskId: task.id, name: task.name, projectId: task.projectId, memberId: task.assigneeId, producerId, rateKey, package: Boolean(task.captacaoId), cards: review?.cards ?? 8, dueDate, deliveredDate: delivered,
      late, qualityProblem, base: 0, total: 0, penalty: settings.penaltyMode === "both" ? late && qualityProblem : late || qualityProblem, ready: !pendencia, pendencia,
      group: `${task.projectId}:${task.captacaoId || task.id}:${producerId}:${rateKey}` };
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

// ---------- Margem por cliente ----------
//
// Receita do cliente menos o que ele custa de verdade: imposto sobre o que ele
// fatura, a produção lançada na conta dele e a fatia das ferramentas que ele
// consome. Ferramenta é assinatura da empresa inteira e não vem carimbada por
// cliente, então é rateada pela participação dele na receita do mês — quem
// fatura mais puxa mais ferramenta. Sem receita no mês, não há rateio.
//
// Operacional, marketing e pró-labore ficam de fora: são custo de existir a
// empresa, não custo de atender aquele cliente. Misturar os dois faria todo
// cliente parecer deficitário nos meses fracos.
export function clientMargins(data: Pick<FinanceData, "entries" | "settings" | "projects">, month: string): ClientMargin[] {
  const live = data.entries.filter((entry) => !entry.cancelled && entry.competence === month);
  const receitaTotal = sum(live.filter((entry) => entry.direction === "income" && entry.projectId));
  const ferramentas = sum(live.filter((entry) => entry.direction === "expense" && entry.category === "ferramentas"));
  return data.projects.map((project) => {
    const revenue = sum(live.filter((entry) => entry.direction === "income" && entry.projectId === project.id));
    const production = sum(live.filter((entry) => entry.direction === "expense" && entry.category === "producao" && entry.projectId === project.id));
    const tools = receitaTotal ? Math.round(ferramentas * revenue / receitaTotal) : 0;
    const tax = data.settings.taxRate === null ? null : Math.round(revenue * data.settings.taxRate / 100);
    const result = tax === null ? null : revenue - tax - production - tools;
    return { projectId: project.id, revenue, tax, production, tools, result, margin: result !== null && revenue ? result / revenue : null };
  });
}

// ---------- O que os contratos valem ----------
//
// Isto substitui o fluxo de caixa. A pergunta não é quando o dinheiro entra —
// isso o Asaas responde — e sim quanto a carteira vale por mês, e até quando.
//
// Cada série recorrente é um contrato: a competência mais antiga é o começo, a
// mais recente é o fim, e o que falta entrar é a soma das competências daqui
// para a frente. Contrato sem data de fim não existe aqui, porque toda série é
// gerada com um número de parcelas — se um dia houver recorrência sem fim, ela
// aparece com o último mês cadastrado, que é a verdade disponível.
export function contractSummaries(entries: Entry[], fromMonth: string): ContractSummary[] {
  const series = new Map<string, Entry[]>();
  for (const entry of entries) {
    if (entry.cancelled || entry.direction !== "income" || !entry.recurring || !entry.projectId) continue;
    const chave = entry.seriesId || entry.id;
    series.set(chave, [...(series.get(chave) ?? []), entry]);
  }
  return [...series.entries()].map(([chave, parcelas]) => {
    const ordenadas = [...parcelas].sort((a, b) => a.competence.localeCompare(b.competence));
    const futuras = ordenadas.filter((parcela) => parcela.competence >= fromMonth);
    const atual = ordenadas.find((parcela) => parcela.competence === fromMonth) ?? futuras[0] ?? ordenadas.at(-1)!;
    return {
      projectId: ordenadas[0].projectId!, seriesId: ordenadas[0].seriesId ?? chave,
      description: ordenadas[0].description.replace(/ · \d+\/\d+$/, ""),
      monthly: atual.amount, first: ordenadas[0].competence, last: ordenadas.at(-1)!.competence,
      monthsLeft: futuras.length, remaining: futuras.reduce((total, parcela) => total + parcela.amount, 0),
    };
  }).sort((a, b) => b.monthly - a.monthly);
}

// Quanto já está contratado em cada um dos próximos meses. É o número que o
// dono pediu: "quanto eu tenho de contratos todos os meses". Não presume
// renovação — mês depois do fim do contrato aparece menor, e é para aparecer.
export function contractedByMonth(entries: Entry[], fromMonth: string, months = 12): { month: string; recurring: number; oneOff: number }[] {
  return Array.from({ length: months }, (_, i) => {
    const key = monthAdd(`${fromMonth}-01`, i).slice(0, 7);
    const doMes = entries.filter((entry) => !entry.cancelled && entry.direction === "income" && entry.competence === key);
    return {
      month: key,
      recurring: doMes.filter((entry) => entry.recurring).reduce((total, entry) => total + entry.amount, 0),
      oneOff: doMes.filter((entry) => !entry.recurring).reduce((total, entry) => total + entry.amount, 0),
    };
  });
}

// ---------- Contrato chegando ao fim ----------
// Contrato que vence sem ninguém renovar tira o cliente do MRR em silêncio, e o
// churn só conta depois que já aconteceu. O aviso existe para chegar antes.
export type ContractAlert = { contractId: string; title: string; projectId: string | null; endsOn: string; days: number };
export function contractAlerts(contracts: Contract[], today: string, within = 30): ContractAlert[] {
  return contracts.flatMap((contract) => {
    if (contract.status !== "assinado") return [];
    const start = contract.fields.vigencia_inicio;
    const months = Number(contract.fields.vigencia_meses);
    if (!start || !validDate(start) || !Number.isInteger(months) || months < 1) return [];
    const endsOn = monthAdd(start, months);
    const days = Math.round((Date.parse(`${endsOn}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
    if (days < 0 || days > within) return [];
    return [{ contractId: contract.id, title: contract.title, projectId: contract.projectId ?? null, endsOn, days }];
  });
}
