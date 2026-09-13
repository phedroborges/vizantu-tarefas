import { getSupabase } from "../supabase-client";
import { listContracts, listMembers, listProjects, listTags, listTasks } from "../storage";
import { balance, contractEntries, productionLines, recurringEntries, validDate } from "./calculations";
import { CATEGORIES, DEFAULT_SETTINGS, type Entry, type EntryInput, type FinanceData, type Payment, type ProductionReview, type Settings } from "./types";

function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
// PostgREST tem limite por página. Histórico financeiro não pode ser truncado.
async function allRows(table: string, order = "id") {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = checked(await getSupabase().from(table).select("*").order(order).range(offset, offset + 999)) ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
const mapEntry = (r: Record<string, unknown>): Entry => ({ id: String(r.id), direction: r.direction as Entry["direction"], category: r.category as Entry["category"], description: String(r.description), amount: Number(r.amount), dueDate: String(r.due_date), competence: String(r.competence), projectId: r.project_id as string | null, memberId: r.member_id as string | null, recurring: Boolean(r.recurring), seriesId: r.series_id as string | null, sourceKey: r.source_key as string | null, cancelled: Boolean(r.cancelled), notes: String(r.notes || ""), createdAt: String(r.created_at) });
const toRow = (e: EntryInput, actor: string) => ({ direction: e.direction, category: e.category, description: e.description, amount: e.amount, due_date: e.dueDate, competence: e.competence, project_id: e.projectId, member_id: e.memberId, recurring: e.recurring, series_id: e.seriesId, source_key: e.sourceKey, notes: e.notes, updated_by: actor });

export async function loadFinance(actor: string): Promise<FinanceData> {
  const db = getSupabase();
  const [contracts, projects, members, tasks, tags, settingsRow] = await Promise.all([
    listContracts(), listProjects(), listMembers(), listTasks({ all: true }), listTags(), db.from("finance_settings").select("data").eq("id", true).maybeSingle().then(checked),
  ]);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...settingsRow?.data, rates: { ...DEFAULT_SETTINGS.rates, ...settingsRow?.data?.rates } };
  const warnings: string[] = [];
  const expected: EntryInput[] = [];
  for (const contract of contracts) {
    const result = contractEntries(contract);
    if (result.warning) warnings.push(result.warning);
    expected.push(...result.entries);
  }
  if (expected.length) checked(await db.from("finance_entries").upsert(expected.map((e) => toRow(e, actor)), { onConflict: "source_key", ignoreDuplicates: true }));
  const [entryRows, paymentRows, blockRows, reviewRows, scoreRows, auditRows] = await Promise.all([
    allRows("finance_entries"), allRows("finance_payments"), allRows("finance_project_blocks", "project_id"), allRows("finance_production_reviews", "task_id"), allRows("client_satisfaction_scores"),
    db.from("finance_audit").select("id,entity_id,action,actor_id,created_at").order("created_at", { ascending: false }).limit(100).then(checked),
  ]);
  const entries = entryRows.map(mapEntry);
  const bySource = new Map(entries.filter((e) => e.sourceKey).map((e) => [e.sourceKey, e]));
  for (const entry of expected) {
    const existing = bySource.get(entry.sourceKey!);
    if (existing && (existing.amount !== entry.amount || existing.dueDate !== entry.dueDate || existing.competence !== entry.competence || existing.projectId !== entry.projectId)) warnings.push(`${entry.description}: contrato e lançamento têm valores ou datas diferentes. Revise; baixas e valores anteriores foram preservados.`);
  }
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  for (const id of new Set(entries.filter((e) => !e.cancelled && e.sourceKey?.startsWith("contract:")).map((e) => e.seriesId))) {
    if (id && contractById.get(id)?.status !== "assinado") warnings.push(`Contrato ${contractById.get(id)?.title || id} encerrado ou removido: confira e cancele as parcelas que não serão devidas.`);
  }
  return {
    entries, settings, contracts, projects, members, tasks, tags, warnings,
    payments: paymentRows.map((r): Payment => ({ id: String(r.id), entryId: String(r.entry_id), amount: Number(r.amount), paidAt: String(r.paid_at), method: String(r.method), reference: String(r.reference), reversed: Boolean(r.reversed) })),
    blocks: blockRows.map((r) => ({ projectId: String(r.project_id), blocked: Boolean(r.blocked), reason: String(r.reason), updatedAt: String(r.updated_at) })),
    reviews: reviewRows.map((r) => ({ ...(r.data as ProductionReview), taskId: String(r.task_id) })),
    scores: scoreRows.map((r) => ({ projectId: String(r.project_id), score: Number(r.score), createdAt: String(r.created_at) })),
    audit: (auditRows ?? []).map((r) => ({ id: r.id, entityId: r.entity_id, action: r.action, actorId: r.actor_id, createdAt: r.created_at })),
  };
}

export class FinanceInputError extends Error {}
function requireText(value: unknown, label: string, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new FinanceInputError(`Informe ${label}.`);
  return value.trim();
}
function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new FinanceInputError("Identificador inválido.");
  return value;
}
function cents(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > 100000000000) throw new FinanceInputError("Informe um valor monetário positivo e válido.");
  return Number(value);
}
function date(value: unknown): string {
  if (typeof value !== "string" || !validDate(value)) throw new FinanceInputError("Data inválida.");
  return value;
}
export function validateSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") throw new FinanceInputError("Configuração inválida.");
  const s = raw as Settings;
  if ((s.taxRate !== null && (!Number.isFinite(s.taxRate) || s.taxRate < 0 || s.taxRate >= 100)) || !Number.isFinite(s.targetMargin) || s.targetMargin < 0 || s.targetMargin >= 100 || !Number.isSafeInteger(s.openingBalance) || Math.abs(s.openingBalance) > 100000000000) throw new FinanceInputError("Revise alíquota, margem e saldo inicial.");
  date(s.openingDate);
  if (typeof s.taxRegime !== "string" || s.taxRegime.length > 100 || !["cash", "competence"].includes(s.taxBasis) || !["calendar", "business"].includes(s.deadlineMode) || !["both", "either"].includes(s.penaltyMode)) throw new FinanceInputError("Revise as regras de cálculo.");
  for (const days of [s.soloDays, s.packageDays]) if (!Number.isInteger(days) || days < 0 || days > 365) throw new FinanceInputError("Prazo inválido.");
  cents(s.extraCard);
  const rates = Object.fromEntries(Object.keys(DEFAULT_SETTINGS.rates).map((key) => {
    const rate = s.rates?.[key as keyof Settings["rates"]];
    if (!rate) throw new FinanceInputError("Tabela de preços incompleta.");
    return [key, { unit: cents(rate.unit), pack: rate.pack === null ? null : cents(rate.pack) }];
  })) as Settings["rates"];
  return { taxRate: s.taxRate, taxRegime: s.taxRegime, taxBasis: s.taxBasis, openingBalance: s.openingBalance, openingDate: s.openingDate, targetMargin: s.targetMargin, deadlineMode: s.deadlineMode, penaltyMode: s.penaltyMode, soloDays: s.soloDays, packageDays: s.packageDays, extraCard: s.extraCard, rates };
}

export async function mutateFinance(body: Record<string, unknown>, actor: string): Promise<void> {
  const db = getSupabase();
  if (body.action === "entry") {
    const direction = body.direction;
    const category = body.category as Entry["category"];
    if (!["income", "expense"].includes(String(direction)) || !Object.hasOwn(CATEGORIES, String(category)) || (direction === "income") !== ["servicos", "campanha", "outras_receitas"].includes(category)) throw new FinanceInputError("Categoria inválida para este lançamento.");
    const competence = String(body.competence || ""); date(`${competence}-01`);
    if (body.recurring !== undefined && typeof body.recurring !== "boolean") throw new FinanceInputError("Recorrência inválida.");
    const months = Number(body.months || 1);
    if (!Number.isInteger(months) || months < 1 || months > 120) throw new FinanceInputError("Prazo deve ter de 1 a 120 meses.");
    const seriesId = uuid(body.requestId); // Reenvio de uma mesma ação não duplica parcelas.
    const entries = recurringEntries({ description: requireText(body.description, "a descrição"), amount: cents(body.amount), direction: direction as Entry["direction"], category, dueDate: date(body.dueDate), competence, projectId: body.projectId ? uuid(body.projectId) : null, memberId: body.memberId ? uuid(body.memberId) : null, recurring: body.recurring === true, seriesId, sourceKey: `manual:${seriesId}`, notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : "" }, months);
    checked(await db.from("finance_entries").upsert(entries.map((entry) => toRow(entry, actor)), { onConflict: "source_key", ignoreDuplicates: true }));
  } else if (body.action === "payment") {
    checked(await db.rpc("finance_settle", { p_entry: uuid(body.entryId), p_amount: cents(body.amount), p_date: date(body.paidAt), p_method: String(body.method || "").slice(0, 100), p_reference: String(body.reference || "").slice(0, 500), p_actor: actor, p_request: uuid(body.requestId) }));
  } else if (body.action === "reverse") {
    checked(await db.rpc("finance_reverse", { p_payment: uuid(body.paymentId), p_actor: actor }));
  } else if (body.action === "cancel") {
    checked(await db.rpc("finance_cancel", { p_entry: uuid(body.entryId), p_actor: actor }));
  } else if (body.action === "edit") {
    const competence = String(body.competence || ""); date(`${competence}-01`);
    checked(await db.rpc("finance_edit", { p_entry: uuid(body.entryId), p_amount: cents(body.amount), p_due: date(body.dueDate), p_competence: competence, p_description: requireText(body.description, "a descrição"), p_notes: String(body.notes || "").slice(0, 2000), p_actor: actor }));
  } else if (body.action === "cancelSeries") {
    checked(await db.rpc("finance_cancel_series", { p_entry: uuid(body.entryId), p_actor: actor }));
  } else if (body.action === "settings") {
    const settings = validateSettings(body.settings);
    checked(await db.from("finance_settings").upsert({ id: true, data: settings, updated_by: actor, updated_at: new Date().toISOString() }));
  } else if (body.action === "block") {
    const projectId = uuid(body.projectId);
    if (typeof body.blocked !== "boolean") throw new FinanceInputError("Situação de bloqueio inválida.");
    const reason = body.blocked ? requireText(body.reason, "o motivo do bloqueio") : "";
    if (body.blocked) {
      const finance = await loadFinance(actor);
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      if (!finance.entries.some((entry) => entry.projectId === projectId && entry.direction === "income" && entry.dueDate < today && balance(entry, finance.payments, today) > 0)) throw new FinanceInputError("Este cliente não possui recebíveis vencidos em aberto.");
    }
    checked(await db.from("finance_project_blocks").upsert({ project_id: projectId, blocked: body.blocked, reason, updated_by: actor, updated_at: new Date().toISOString() }));
  } else if (body.action === "review") {
    const taskId = uuid(body.taskId);
    const raw = body.review as ProductionReview;
    if (!raw || (raw.rateKey !== null && !Object.hasOwn(DEFAULT_SETTINGS.rates, raw.rateKey)) || !Number.isInteger(raw.cards) || raw.cards < 1 || raw.cards > 100 || typeof raw.qualityProblem !== "boolean") throw new FinanceInputError("Revisão de produção inválida.");
    if (raw.deliveredDate && raw.deliveredDate > new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())) throw new FinanceInputError("Entrega não pode ter data futura.");
    const review: ProductionReview = { taskId, rateKey: raw.rateKey, cards: raw.cards, deliveredDate: raw.deliveredDate ? date(raw.deliveredDate) : null, qualityProblem: raw.qualityProblem, notes: String(raw.notes || "").slice(0, 1000) };
    checked(await db.from("finance_production_reviews").upsert({ task_id: taskId, data: review, updated_by: actor, updated_at: new Date().toISOString() }));
  } else if (body.action === "production") {
    const taskId = uuid(body.taskId);
    const data = await loadFinance(actor);
    const line = productionLines(data.tasks, data.tags, data.reviews, data.settings).find((item) => item.taskId === taskId);
    if (!line?.ready) throw new FinanceInputError("Confirme formato, responsável e data de entrega antes de lançar o pagamento.");
    checked(await db.from("finance_entries").upsert(toRow({ direction: "expense", category: "producao", description: `Produção · ${line.name}`, amount: line.total, dueDate: date(body.dueDate), competence: line.deliveredDate!.slice(0, 7), projectId: line.projectId, memberId: line.memberId!, recurring: false, seriesId: null, sourceKey: `production:${line.taskId}`, notes: `Base ${line.base} centavos; ${line.penalty ? "50% por atraso/problema conforme regra configurada" : "integral"}. Prazo ${line.dueDate}.` }, actor), { onConflict: "source_key", ignoreDuplicates: true }));
  } else {
    throw new FinanceInputError("Ação financeira inválida.");
  }
}
