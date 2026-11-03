import { getSupabase } from "../supabase-client";
import { createNotifications, listContracts, listMembers, listProjects, listTags, listTasks } from "../storage";
import { brl, competenceOf, contractEntries, monthAdd, monthName, productionLines, recurringEntries, teamClosingsFromLines, validDate, type ProductionLine } from "./calculations";
import { CATEGORIES, DEFAULT_SETTINGS, type Closing, type ClosingLine, type Entry, type EntryInput, type FinanceData, type Settings } from "./types";

function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
// PostgREST tem limite por página. Histórico financeiro não pode ser truncado.
async function allRows(table: string, order = "id", category?: string) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = getSupabase().from(table).select("*").order(order).range(offset, offset + 999);
    if (category) query = query.eq("category", category);
    const result = await query;
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
const mapEntry = (r: Record<string, unknown>): Entry => ({ id: String(r.id), direction: r.direction as Entry["direction"], category: r.category as Entry["category"], description: String(r.description), amount: Number(r.amount), competence: String(r.competence), projectId: r.project_id as string | null, memberId: r.member_id as string | null, recurring: Boolean(r.recurring), seriesId: r.series_id as string | null, sourceKey: r.source_key as string | null, cancelled: Boolean(r.cancelled), notes: String(r.notes || ""), createdAt: String(r.created_at) });
const mapClosing = (r: Record<string, unknown>): Closing => ({ id: String(r.id), number: Number(r.number), memberId: String(r.member_id), competence: String(r.competence), total: Number(r.total), lines: (r.lines ?? []) as ClosingLine[], taskIds: (r.task_ids ?? []) as string[], closedAt: String(r.closed_at), closedBy: (r.closed_by as string | null) ?? null, paidOn: (r.paid_on as string | null) ?? null, invoiceName: (r.invoice_name as string | null) ?? null, invoiceUploadedAt: (r.invoice_uploaded_at as string | null) ?? null });
const toRow = (e: EntryInput, actor: string | null) => ({ direction: e.direction, category: e.category, description: e.description, amount: e.amount, due_date: `${e.competence}-01`, competence: e.competence, project_id: e.projectId, member_id: e.memberId, recurring: e.recurring, series_id: e.seriesId, source_key: e.sourceKey, notes: e.notes, updated_by: actor });

export async function loadFinance(actor: string, options: { includeProduction?: boolean } = {}): Promise<FinanceData> {
  const includeProduction = options.includeProduction !== false;
  const db = getSupabase();
  const [contracts, projects, members, tasks, tags, settingsRow, storedEntries, blockRows, scoreRows, auditRows, closingRows] = await Promise.all([
    listContracts(), listProjects(), listMembers(), includeProduction ? listTasks({ all: true, projection: "production", includeArchivedPlans: true }) : Promise.resolve([]), includeProduction ? listTags() : Promise.resolve([]), db.from("finance_settings").select("data").eq("id", true).maybeSingle().then(checked),
    allRows("finance_entries"), allRows("finance_project_blocks", "project_id"), allRows("client_satisfaction_scores"),
    db.from("finance_audit").select("id,entity_id,action,actor_id,created_at").order("created_at", { ascending: false }).limit(100).then(checked),
    allRows("finance_closings", "competence"),
  ]);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...settingsRow?.data, rates: { ...DEFAULT_SETTINGS.rates, ...settingsRow?.data?.rates } };
  const warnings: string[] = [];
  const expected: EntryInput[] = [];
  for (const contract of contracts) {
    const imported = settings.importedContractIds?.includes(contract.id) || storedEntries.some((entry) => String(entry.source_key || "").startsWith(`contract:${contract.id}:`));
    if (!imported || settings.excludedContractIds?.includes(contract.id)) continue;
    const result = contractEntries(contract, settings);
    if (result.warning) warnings.push(result.warning);
    expected.push(...result.entries);
  }
  // Abrir o painel normalmente é só leitura. Gera apenas parcelas novas;
  // não reenvia todo o contrato ao banco em cada navegação ou fechamento.
  const existingSources = new Set(storedEntries.map((entry) => entry.source_key));
  const missing = expected.filter((entry) => !existingSources.has(entry.sourceKey));
  let entryRows = storedEntries;
  let visibleAuditRows = auditRows;
  if (missing.length) {
    checked(await db.from("finance_entries").upsert(missing.map((entry) => toRow(entry, actor)), { onConflict: "source_key", ignoreDuplicates: true }));
    // Relê depois da escrita: outra requisição pode ter criado a mesma parcela.
    [entryRows, visibleAuditRows] = await Promise.all([
      allRows("finance_entries"),
      db.from("finance_audit").select("id,entity_id,action,actor_id,created_at").order("created_at", { ascending: false }).limit(100).then(checked),
    ]);
  }
  const entries = entryRows.map(mapEntry);
  const bySource = new Map(entries.filter((e) => e.sourceKey).map((e) => [e.sourceKey, e]));
  for (const entry of expected) {
    const existing = bySource.get(entry.sourceKey!);
    if (existing && (existing.amount !== entry.amount || existing.competence !== entry.competence || existing.projectId !== entry.projectId)) warnings.push(`${entry.description}: contrato e lançamento têm valores ou datas diferentes. Revise; baixas e valores anteriores foram preservados.`);
  }
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  for (const id of new Set(entries.filter((e) => !e.cancelled && e.sourceKey?.startsWith("contract:")).map((e) => e.seriesId))) {
    if (id && contractById.get(id)?.status !== "assinado") warnings.push(`Contrato ${contractById.get(id)?.title || id} encerrado ou removido: confira e cancele as parcelas que não serão devidas.`);
  }
  return {
    entries, settings, contracts, projects, members, tasks, tags, warnings, closings: closingRows.map(mapClosing),
    blocks: blockRows.map((r) => ({ projectId: String(r.project_id), blocked: Boolean(r.blocked), reason: String(r.reason), updatedAt: String(r.updated_at) })),
    reviews: [],
    scores: scoreRows.map((r) => ({ projectId: String(r.project_id), score: Number(r.score), createdAt: String(r.created_at) })),
    audit: (visibleAuditRows ?? []).map((r) => ({ id: r.id, entityId: r.entity_id, action: r.action, actorId: r.actor_id, createdAt: r.created_at })),
  };
}

// Produção não depende de contratos, NPS, bloqueios ou auditoria. Falha em uma
// dessas integrações não impede consultar a equipe e fechar suas entregas.
export async function loadFinanceProduction(): Promise<FinanceData> {
  const [projects, members, tasks, tags, settingsRow, entryRows, closingRows] = await Promise.all([
    listProjects(), listMembers(), listTasks({ all: true, projection: "production", includeArchivedPlans: true }), listTags(),
    getSupabase().from("finance_settings").select("data").eq("id", true).maybeSingle().then(checked),
    allRows("finance_entries", "id", "producao"), allRows("finance_closings", "competence"),
  ]);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...settingsRow?.data, rates: { ...DEFAULT_SETTINGS.rates, ...settingsRow?.data?.rates } };
  return { projects, members, tasks, tags, settings, entries: entryRows.map(mapEntry), closings: closingRows.map(mapClosing), reviews: [],
    contracts: [], blocks: [], scores: [], audit: [], warnings: [] };
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
  if ((s.taxRate !== null && (!Number.isFinite(s.taxRate) || s.taxRate < 0 || s.taxRate >= 100)) || !Number.isFinite(s.targetMargin) || s.targetMargin < 0 || s.targetMargin >= 100) throw new FinanceInputError("Revise a alíquota e a margem-alvo.");
  if (typeof s.taxRegime !== "string" || s.taxRegime.length > 100 || !["calendar", "business"].includes(s.deadlineMode) || !["both", "either"].includes(s.penaltyMode)) throw new FinanceInputError("Revise as regras de cálculo.");
  for (const days of [s.soloDays, s.packageDays]) if (!Number.isInteger(days) || days < 0 || days > 365) throw new FinanceInputError("Prazo inválido.");
  if (!Number.isFinite(s.annualAdjustment) || s.annualAdjustment < 0 || s.annualAdjustment > 100) throw new FinanceInputError("Reajuste anual inválido.");
  cents(s.extraCard);
  const rates = Object.fromEntries(Object.keys(DEFAULT_SETTINGS.rates).map((key) => {
    const rate = s.rates?.[key as keyof Settings["rates"]];
    if (!rate) throw new FinanceInputError("Tabela de preços incompleta.");
    return [key, { unit: cents(rate.unit), pack: rate.pack === null ? null : cents(rate.pack) }];
  })) as Settings["rates"];
  return { taxRate: s.taxRate, taxRegime: s.taxRegime, targetMargin: s.targetMargin, deadlineMode: s.deadlineMode, penaltyMode: s.penaltyMode, soloDays: s.soloDays, packageDays: s.packageDays, annualAdjustment: s.annualAdjustment, extraCard: s.extraCard, rates };
}

export async function mutateFinance(body: Record<string, unknown>, actor: string): Promise<void> {
  const db = getSupabase();
  if (body.action === "entry") {
    const direction = body.direction;
    const category = body.category as Entry["category"];
    if (!["income", "expense"].includes(String(direction)) || !Object.hasOwn(CATEGORIES, String(category)) || (direction === "income") !== ["servicos", "campanha", "outras_receitas"].includes(category)) throw new FinanceInputError("Categoria inválida para este lançamento.");
    const competence = String(body.competence || ""); date(`${competence}-01`);
    if (body.recurring !== undefined && typeof body.recurring !== "boolean") throw new FinanceInputError("Recorrência inválida.");
    if (body.contract === true && (direction !== "income" || category !== "servicos" || body.recurring !== true || !body.projectId)) throw new FinanceInputError("Um contrato financeiro precisa de cliente e receita recorrente.");
    const months = Number(body.months || 1);
    if (!Number.isInteger(months) || months < 1 || months > 120) throw new FinanceInputError("Prazo deve ter de 1 a 120 meses.");
    const seriesId = uuid(body.requestId); // Reenvio de uma mesma ação não duplica parcelas.
    const entries = recurringEntries({ description: requireText(body.description, "a descrição"), amount: cents(body.amount), direction: direction as Entry["direction"], category, competence, projectId: body.projectId ? uuid(body.projectId) : null, memberId: body.memberId ? uuid(body.memberId) : null, recurring: body.recurring === true, seriesId, sourceKey: `manual:${seriesId}`, notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : "" }, months);
    checked(await db.from("finance_entries").upsert(entries.map((entry) => toRow(entry, actor)), { onConflict: "source_key", ignoreDuplicates: true }));
  } else if (body.action === "cancel") {
    checked(await db.rpc("finance_cancel", { p_entry: uuid(body.entryId), p_actor: actor }));
  } else if (body.action === "edit") {
    const competence = String(body.competence || ""); date(`${competence}-01`);
    checked(await db.rpc("finance_edit", { p_entry: uuid(body.entryId), p_amount: cents(body.amount), p_due: `${competence}-01`, p_competence: competence, p_description: requireText(body.description, "a descrição"), p_notes: String(body.notes || "").slice(0, 2000), p_actor: actor }));
  } else if (body.action === "cancelSeries") {
    checked(await db.rpc("finance_cancel_series", { p_entry: uuid(body.entryId), p_actor: actor }));
  } else if (body.action === "settings") {
    const settings = validateSettings(body.settings);
    await updatePreferences(actor, (current) => ({ ...current, ...settings }));
  } else if (body.action === "compensation") {
    const memberId = uuid(body.memberId);
    const fromMonth = String(body.fromMonth || ""); date(`${fromMonth}-01`);
    const mode = body.mode;
    if (mode !== "salary" && mode !== "demand" && mode !== "none") throw new FinanceInputError("Modalidade de remuneração inválida.");
    const salary = mode === "salary" ? cents(body.salary) : 0;
    const member = (await listMembers()).find((person) => person.id === memberId);
    if (!member || !["diretor_criativo", "social_media"].includes(member.role)) throw new FinanceInputError("Escolha um diretor criativo ou social media.");
    await updatePreferences(actor, (current) => ({ ...current, compensationRules: [...(current.compensationRules ?? []).filter((rule) => rule.memberId !== memberId || rule.fromMonth !== fromMonth), { memberId, fromMonth, mode, salary }] }));
  } else if (body.action === "salary") {
    const memberId = uuid(body.memberId);
    const competence = String(body.competence || ""); date(`${competence}-01`);
    const data = await loadFinanceProduction();
    const closing = teamClosingsFromLines(productionLines(data.tasks, data.tags, data.settings, data.members, data.closings), data.entries, data.members, data.settings, competence).find((item) => item.producerId === memberId && item.paymentMode === "salary");
    if (!closing?.pending) throw new FinanceInputError("Nenhum salário pendente nesta competência.");
    const name = data.members.find((person) => person.id === memberId)?.name || "Equipe";
    checked(await db.from("finance_entries").upsert(toRow({ direction: "expense", category: "producao", description: `Salário fixo · ${name}`, amount: closing.pending, competence, projectId: null, memberId, recurring: false, seriesId: null, sourceKey: `salary:${memberId}:${competence}`, notes: `Salário mensal configurado: ${closing.salary} centavos. Complemento após despesas já registradas para esta pessoa na competência.` }, actor), { onConflict: "source_key", ignoreDuplicates: true }));
  } else if (body.action === "importContract") {
    const contractId = uuid(body.contractId);
    const contract = (await listContracts()).find((item) => item.id === contractId);
    if (!contract) throw new FinanceInputError("Contrato não encontrado.");
    const settings = await updatePreferences(actor, (current) => {
      const result = contractEntries(contract, current);
      if (!result.entries.length) throw new FinanceInputError(result.warning || "Somente contratos assinados e completos podem ser adicionados.");
      return { ...current, importedContractIds: [...new Set([...(current.importedContractIds ?? []), contractId])], excludedContractIds: (current.excludedContractIds ?? []).filter((id) => id !== contractId) };
    });
    const existing = new Set((await allRows("finance_entries")).map((row) => row.source_key));
    const missing = contractEntries(contract, settings).entries.filter((entry) => !existing.has(entry.sourceKey));
    if (missing.length) checked(await db.from("finance_entries").upsert(missing.map((entry) => toRow(entry, actor)), { onConflict: "source_key", ignoreDuplicates: true }));
    if (body.restore === true) checked(await db.from("finance_entries").update({ cancelled: false, updated_by: actor, updated_at: new Date().toISOString() }).eq("series_id", contractId).eq("cancelled", true));
  } else if (body.action === "removeContract") {
    const seriesId = uuid(body.seriesId);
    const rows = (await allRows("finance_entries")).map(mapEntry).filter((entry) => entry.seriesId === seriesId && entry.direction === "income").sort((a, b) => a.competence.localeCompare(b.competence));
    if (!rows.length) throw new FinanceInputError("Contrato financeiro não encontrado.");
    await updatePreferences(actor, (current) => ({ ...current, excludedContractIds: [...new Set([...(current.excludedContractIds ?? []), seriesId])] }));
    const first = rows.find((entry) => !entry.cancelled);
    if (first) checked(await db.rpc("finance_cancel_series", { p_entry: first.id, p_actor: actor }));
  } else if (body.action === "block") {
    const projectId = uuid(body.projectId);
    if (typeof body.blocked !== "boolean") throw new FinanceInputError("Situação de bloqueio inválida.");
    // Sem controle de atraso, quem sabe que o cliente não pagou é o dono, com o
    // Asaas na outra aba. O motivo escrito é o que fica no lugar do gatilho
    // automático: bloqueio sem justificativa registrada não é decisão, é acidente.
    const reason = body.blocked ? requireText(body.reason, "o motivo do bloqueio") : "";
    checked(await db.from("finance_project_blocks").upsert({ project_id: projectId, blocked: body.blocked, reason, updated_by: actor, updated_at: new Date().toISOString() }));
  } else if (body.action === "production" || body.action === "productionClosing") {
    const data = await loadFinanceProduction();
    const todas = productionLines(data.tasks, data.tags, data.settings, data.members, data.closings);
    let alvo: typeof todas;
    if (body.action === "production") {
      const taskId = uuid(body.taskId);
      const line = todas.find((item) => item.taskId === taskId);
      if (!line?.ready) throw new FinanceInputError(line?.pendencia || "A tarefa precisa estar aprovada ou finalizada, com responsável e formato válidos.");
      alvo = [line];
    } else {
      // Fechamento do mês de uma pessoa. O servidor recalcula e filtra sozinho:
      // aceitar uma lista de tarefas vinda do cliente seria aceitar pagar o que
      // ele mandasse, inclusive peça de outro diretor ou de outro mês.
      const producerId = uuid(body.memberId);
      const competence = String(body.competence || ""); date(`${competence}-01`);
      alvo = todas.filter((line) => line.ready && line.producerId === producerId && competenceOf(line) === competence);
      if (!alvo.length) throw new FinanceInputError("Nenhuma tarefa aprovada ou finalizada e pendente para esta pessoa nesta competência.");
    }
    // source_key por tarefa: reenviar o fechamento não paga a mesma peça duas vezes.
    checked(await db.from("finance_entries").upsert(alvo.map((line) => toRow({ direction: "expense", category: "producao", description: `Produção · ${line.name}`, amount: line.total, competence: competenceOf(line)!, projectId: line.projectId, memberId: line.producerId!, recurring: false, seriesId: null, sourceKey: `production:${line.taskId}`, notes: `Base ${line.base} centavos; ${line.penalty ? "50% por atraso/problema conforme regra configurada" : "integral"}. Prazo ${line.dueDate}.` }, actor)), { onConflict: "source_key", ignoreDuplicates: true }));
  } else if (body.action === "closeMonth") {
    await closeMonth(body, actor);
  } else if (body.action === "adjustClosing") {
    await adjustClosing(body, actor);
  } else if (body.action === "markPaid") {
    const closingId = uuid(body.closingId);
    const paidOn = String(body.paidOn || ""); date(paidOn);
    const [row] = checked(await db.from("finance_closings").update({ paid_on: paidOn, paid_by: actor }).eq("id", closingId).select("*")) ?? [];
    if (!row) throw new FinanceInputError("Fechamento não encontrado.");
    const closing = mapClosing(row);
    await createNotifications([{ recipientMemberId: closing.memberId, actorMemberId: actor, type: "finance_closing",
      title: `Pagamento de ${monthName(closing.competence)} feito`,
      body: `${brl(closing.total)}${closing.invoiceName ? "" : ". Emita a nota fiscal neste valor e envie em Meu financeiro."}`,
      actionUrl: "/meu-financeiro", dedupeKey: `closing-paid:${closing.id}:${paidOn}` }]);
  } else {
    throw new FinanceInputError("Ação financeira inválida.");
  }
}

function adjustmentsOf(value: unknown): { description: string; amount: number }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new FinanceInputError("Ajustes inválidos.");
  return value.map((item) => {
    const amount = Number(item?.amount);
    if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 100000000000) throw new FinanceInputError("Informe o valor de cada ajuste.");
    return { description: requireText(item?.description, "o motivo de cada ajuste", 200), amount };
  });
}

const KIND_ORDER: ClosingLine["kind"][] = ["peca", "salario", "outro", "ajuste"];

// O comprovante é o que ficou lançado para a pessoa no mês, e não a estimativa.
function closingItems(booked: Entry[], lines: ProductionLine[], data: FinanceData): ClosingLine[] {
  const projectName = new Map(data.projects.map((project) => [project.id, project.name]));
  const lineByTask = new Map(lines.map((line) => [line.taskId, line]));
  return booked.map((entry): ClosingLine => {
    const taskId = entry.sourceKey?.startsWith("production:") ? entry.sourceKey.slice("production:".length) : undefined;
    const line = taskId ? lineByTask.get(taskId) : undefined;
    const kind = taskId ? "peca" : entry.sourceKey?.startsWith("salary:") ? "salario" : entry.sourceKey?.startsWith("ajuste:") ? "ajuste" : "outro";
    return { kind, description: line?.name ?? entry.description.replace(/^(Produção|Ajuste) · /, ""), amount: entry.amount, taskId, projectName: entry.projectId ? projectName.get(entry.projectId) : undefined, deliveredDate: line?.deliveredDate ?? undefined };
  }).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.deliveredDate ?? "").localeCompare(b.deliveredDate ?? "") || a.description.localeCompare(b.description, "pt-BR"));
}
async function bookedFor(memberId: string, competence: string): Promise<Entry[]> {
  return (await allRows("finance_entries", "id", "producao")).map(mapEntry).filter((entry) => !entry.cancelled && entry.memberId === memberId && entry.competence === competence);
}
const adjustmentRows = (adjustments: { description: string; amount: number }[], memberId: string, competence: string, requestId: string, actor: string | null) =>
  adjustments.map((adjustment, index) => toRow({ direction: "expense", category: "producao", description: `Ajuste · ${adjustment.description}`, amount: adjustment.amount, competence, projectId: null, memberId, recurring: false, seriesId: null, sourceKey: `ajuste:${requestId}:${index}`, notes: `Combinado no fechamento de ${competence}.` }, actor));

// O mês fecha sozinho quando termina: no primeiro dia do mês seguinte o
// sistema fecha quem tem valor a receber no mês anterior. Se o servidor estiver
// fora nesse dia, fecha na próxima varredura. Devolve quem foi fechado agora.
export async function closeFinishedMonth(today: string): Promise<{ name: string; total: number }[]> {
  const competence = monthAdd(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const data = await loadFinanceProduction();
  const lines = productionLines(data.tasks, data.tags, data.settings, data.members, data.closings);
  const open = teamClosingsFromLines(lines, data.entries, data.members, data.settings, competence)
    .filter((closing) => closing.total > 0 && !data.closings.some((item) => item.memberId === closing.producerId && item.competence === competence));
  const closed: { name: string; total: number }[] = [];
  for (const closing of open) {
    try {
      const total = await closeMonth({ memberId: closing.producerId, competence, requestId: crypto.randomUUID() }, null);
      closed.push({ name: data.members.find((member) => member.id === closing.producerId)?.name ?? "Equipe", total });
    } catch (error) {
      // Outra réplica já fechou, ou esta pessoa falhou: as outras seguem.
      if (!(error instanceof FinanceInputError)) console.error(`[fechamento] ${closing.producerId} ${competence}:`, error);
    }
  }
  return closed;
}

// Fechar o mês de uma pessoa: lança o que faltava (peças ou salário), grava os
// ajustes combinados e congela o comprovante com tudo que ficou lançado para
// ela no mês. Depois disso o mês não muda: peça aprovada atrasada vai para o
// próximo mês aberto. Sem ator, foi o fechamento automático.
async function closeMonth(body: Record<string, unknown>, actor: string | null): Promise<number> {
  const db = getSupabase();
  const memberId = uuid(body.memberId);
  const competence = String(body.competence || ""); date(`${competence}-01`);
  const requestId = uuid(body.requestId);
  const adjustments = adjustmentsOf(body.adjustments);
  const data = await loadFinanceProduction();
  const person = data.members.find((member) => member.id === memberId);
  if (!person) throw new FinanceInputError("Pessoa não encontrada.");
  if (data.closings.some((closing) => closing.memberId === memberId && closing.competence === competence)) throw new FinanceInputError(`O mês de ${person.name} já foi fechado.`);
  const lines = productionLines(data.tasks, data.tags, data.settings, data.members, data.closings);
  const closing = teamClosingsFromLines(lines, data.entries, data.members, data.settings, competence).find((item) => item.producerId === memberId);
  const rows: ReturnType<typeof toRow>[] = [];
  if (closing?.paymentMode === "salary") {
    if (closing.pending) rows.push(toRow({ direction: "expense", category: "producao", description: `Salário fixo · ${person.name}`, amount: closing.pending, competence, projectId: null, memberId, recurring: false, seriesId: null, sourceKey: `salary:${memberId}:${competence}`, notes: `Salário mensal configurado: ${closing.salary} centavos. Complemento após despesas já registradas para esta pessoa na competência.` }, actor));
  } else if (closing) {
    for (const line of closing.lines.filter((item) => closing.pendingTaskIds.includes(item.taskId))) {
      rows.push(toRow({ direction: "expense", category: "producao", description: `Produção · ${line.name}`, amount: line.total, competence, projectId: line.projectId, memberId, recurring: false, seriesId: null, sourceKey: `production:${line.taskId}`, notes: `Base ${line.base} centavos; ${line.penalty ? "50% por atraso/problema conforme regra configurada" : "integral"}. Prazo ${line.dueDate}.` }, actor));
    }
  }
  rows.push(...adjustmentRows(adjustments, memberId, competence, requestId, actor));
  if (rows.length) checked(await db.from("finance_entries").upsert(rows, { onConflict: "source_key", ignoreDuplicates: true }));

  const booked = await bookedFor(memberId, competence);
  if (!booked.length) throw new FinanceInputError(`Nada a fechar para ${person.name} em ${monthName(competence)}.`);
  const items = closingItems(booked, lines, data);
  // No salário as peças estão incluídas; por demanda, só as que foram pagas.
  // Peça sem valor fica de fora e segue para o próximo mês quando for corrigida.
  const taskIds = closing?.paymentMode === "salary" ? closing.lines.map((line) => line.taskId) : items.flatMap((item) => item.taskId ? [item.taskId] : []);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const inserted = await db.from("finance_closings").insert({ member_id: memberId, competence, total, lines: items, task_ids: taskIds, closed_by: actor }).select("*");
  if (inserted.error?.code === "23505") throw new FinanceInputError(`O mês de ${person.name} já foi fechado.`);
  const [row] = checked(inserted) ?? [];
  await createNotifications([{ recipientMemberId: memberId, actorMemberId: actor ?? undefined, type: "finance_closing",
    title: `Seu fechamento de ${monthName(competence)} está pronto`, body: `${brl(total)}. O comprovante está em Meu financeiro.`,
    actionUrl: "/meu-financeiro", dedupeKey: `closing:${row?.id ?? `${memberId}:${competence}`}` }]);
  return total;
}

// Combinado depois do fechamento: acréscimo ou desconto entra no mesmo
// comprovante até o pagamento ser registrado. Depois de pago, não muda mais.
async function adjustClosing(body: Record<string, unknown>, actor: string) {
  const db = getSupabase();
  const closing = await getClosing(uuid(body.closingId));
  if (!closing) throw new FinanceInputError("Fechamento não encontrado.");
  if (closing.paidOn) throw new FinanceInputError("Este mês já foi pago. O comprovante não muda mais.");
  const adjustments = adjustmentsOf(body.adjustments);
  if (!adjustments.length) throw new FinanceInputError("Adicione pelo menos um ajuste.");
  checked(await db.from("finance_entries").upsert(adjustmentRows(adjustments, closing.memberId, closing.competence, uuid(body.requestId), actor), { onConflict: "source_key", ignoreDuplicates: true }));
  const data = await loadFinanceProduction();
  const items = closingItems(await bookedFor(closing.memberId, closing.competence), productionLines(data.tasks, data.tags, data.settings, data.members, data.closings), data);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const updated = checked(await db.from("finance_closings").update({ lines: items, total }).eq("id", closing.id).is("paid_on", null).select("id"));
  if (!updated?.length) throw new FinanceInputError("Este mês foi pago enquanto você ajustava. Atualize a página.");
}

// ---------- Nota fiscal do fechamento ----------
// Área privada: o arquivo só abre por link temporário gerado aqui.
const INVOICE_BUCKET = "notas-fiscais";
const INVOICE_TYPES: Record<string, string> = { "application/pdf": "pdf", "application/xml": "xml", "text/xml": "xml", "image/png": "png", "image/jpeg": "jpg" };
export const MAX_INVOICE_BYTES = 10 * 1024 * 1024;

export async function getClosing(id: string): Promise<Closing | null> {
  const row = checked(await getSupabase().from("finance_closings").select("*").eq("id", id).maybeSingle());
  return row ? mapClosing(row) : null;
}

export async function attachInvoice(closing: Closing, file: File, actorId: string): Promise<void> {
  const mime = file.type.split(";")[0].trim().toLowerCase();
  const extension = INVOICE_TYPES[mime] ?? (/\.xml$/i.test(file.name) ? "xml" : undefined);
  if (!extension) throw new FinanceInputError("Envie a nota em PDF, XML, PNG ou JPG.");
  if (!file.size || file.size > MAX_INVOICE_BYTES) throw new FinanceInputError("A nota precisa ter até 10MB.");
  const db = getSupabase();
  const path = `${closing.memberId}/${closing.competence}-${closing.number}-${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage.from(INVOICE_BUCKET).upload(path, file, { contentType: extension === "xml" ? "application/xml" : mime });
  if (error) throw new Error(error.message);
  const previous = checked(await db.from("finance_closings").select("invoice_path").eq("id", closing.id).maybeSingle()) as { invoice_path: string | null } | null;
  checked(await db.from("finance_closings").update({ invoice_path: path, invoice_name: file.name.slice(0, 200) || `nota.${extension}`, invoice_uploaded_at: new Date().toISOString() }).eq("id", closing.id));
  // Trocar a nota não deixa a antiga perdida na área privada.
  if (previous?.invoice_path) await db.storage.from(INVOICE_BUCKET).remove([previous.invoice_path]);
  const members = await listMembers();
  const person = members.find((member) => member.id === closing.memberId);
  await createNotifications(members.filter((member) => member.role === "dono" && member.active && member.id !== actorId).map((dono) => ({
    recipientMemberId: dono.id, actorMemberId: actorId, type: "finance_closing" as const,
    title: `Nota fiscal recebida · ${person?.name ?? "Equipe"}`, body: `${monthName(closing.competence)} · ${brl(closing.total)}`,
    actionUrl: "/financeiro", dedupeKey: `invoice:${path}:${dono.id}`,
  })));
}

export async function invoiceLink(closing: Closing): Promise<string | null> {
  const row = checked(await getSupabase().from("finance_closings").select("invoice_path").eq("id", closing.id).maybeSingle()) as { invoice_path: string | null } | null;
  if (!row?.invoice_path) return null;
  const { data, error } = await getSupabase().storage.from(INVOICE_BUCKET).createSignedUrl(row.invoice_path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// Preferences and numerical settings share the existing audited JSON row.
// The timestamp comparison prevents silently overwriting another owner's save.
async function updatePreferences(actor: string, change: (settings: Settings) => Settings) {
  const db = getSupabase();
  const row = checked(await db.from("finance_settings").select("data,updated_at").eq("id", true).maybeSingle());
  const current = { ...DEFAULT_SETTINGS, ...row?.data, rates: { ...DEFAULT_SETTINGS.rates, ...row?.data?.rates } } as Settings;
  const values = { data: change(current), updated_by: actor, updated_at: new Date().toISOString() };
  if (row?.updated_at) {
    const updated = checked(await db.from("finance_settings").update(values).eq("id", true).eq("updated_at", row.updated_at).select("id"));
    if (!updated?.length) throw new FinanceInputError("O financeiro foi atualizado em outra sessão. Atualize a página e tente novamente.");
  } else checked(await db.from("finance_settings").upsert({ id: true, ...values }));
  return values.data;
}
