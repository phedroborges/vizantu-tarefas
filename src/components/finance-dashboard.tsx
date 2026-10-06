"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CalendarDays, Check, ChevronLeft, ChevronRight, Download, Eye, FileSignature, Landmark, Link2, LockKeyhole, Plus, RefreshCw, Settings2, ShieldCheck, TrendingUp, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/vz";
import { Avatar } from "@/components/avatar";
import { renderMarkdownLite } from "@/components/markdown-lite";
import { responseError } from "@/lib/request-error";
import { useConfirm } from "@/components/confirm-dialog";
import { brl, clientMargins, contractAlerts, contractSummaries, contractedByMonth, growthProjection, metrics, monthAdd, priceSuggestion, producerClosing, productionLines, productionRoster, money, type ProductionLine } from "@/lib/finance/calculations";
import { CATEGORIES, RATE_LABELS, type Entry, type FinanceData, type RateKey, type Settings } from "@/lib/finance/types";
import { TASK_STATUSES, type Task } from "@/lib/types";
import "@/app/financeiro/finance.css";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
const display = (value: number | null) => value === null ? "—" : brl(value);
const percent = (value: number | null) => value === null ? "—" : `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const inputMoney = (value: number) => (value / 100).toFixed(2).replace(".", ",");
const monthLabel = (month: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(`${month}-01T12:00:00-03:00`));
type Tab = "contracts" | "oneoff" | "costs" | "overview" | "production" | "settings";
const TABS: { id: Tab; label: string }[] = [{ id: "contracts", label: "Contratos" }, { id: "oneoff", label: "Avulsos" }, { id: "costs", label: "Custos" }, { id: "overview", label: "Visão geral" }, { id: "production", label: "Produção da equipe" }, { id: "settings", label: "Configurações" }];

async function fetchFinance(section: "overview" | "production", signal?: AbortSignal): Promise<FinanceData> {
  const timeout = AbortSignal.timeout(30_000);
  const response = await fetch(`/api/financeiro?section=${section}`, { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(await responseError(response, "carregar o financeiro"));
  return response.json();
}
const financeError = (error: unknown) => error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
  ? "O financeiro demorou para responder. Tente novamente." : error instanceof Error ? error.message : "Não foi possível carregar o financeiro.";

export function FinanceDashboard({ initialData }: { initialData?: FinanceData }) {
  const [overviewData, setOverviewData] = useState<FinanceData | null>(initialData || null);
  const [productionData, setProductionData] = useState<FinanceData | null>(initialData || null);
  const [tab, setTab] = useState<Tab>("contracts");
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [overviewError, setOverviewError] = useState("");
  const [productionError, setProductionError] = useState("");
  const [notice, setNotice] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(!initialData);
  const [productionLoading, setProductionLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryProject, setEntryProject] = useState("");
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const section = tab === "production" ? "production" : "overview";
  const data = section === "production" ? productionData : overviewData;
  const error = section === "production" ? productionError : overviewError;
  const loading = section === "production" ? productionLoading : overviewLoading;
  const setData = section === "production" ? setProductionData : setOverviewData;
  const setError = section === "production" ? setProductionError : setOverviewError;
  const setLoading = section === "production" ? setProductionLoading : setOverviewLoading;
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await fetchFinance(section)); }
    catch (error) { setError(financeError(error)); }
    finally { setLoading(false); }
  }, [section, setData, setError, setLoading]);
  const hasData = Boolean(data);
  useEffect(() => {
    if (hasData) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const result = await fetchFinance(section, controller.signal);
        if (!controller.signal.aborted) setData(result);
      } catch (error) { if (!controller.signal.aborted) setError(financeError(error)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [section, hasData, setData, setError, setLoading]);
  async function mutate(payload: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/financeiro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await responseError(response, "salvar o financeiro"));
      // Um fechamento altera os custos; uma configuração altera a produção.
      if (section === "production") setOverviewData(null); else setProductionData(null);
      await load(); setNotice("Alteração registrada."); return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar."); return false; }
    finally { setBusy(false); }
  }
  const stats = useMemo(() => data ? metrics(data, month) : null, [data, month]);
  function createRevenue(projectId = "") { setEntryProject(projectId); setEntryOpen(true); }
  return <main className="fin-page">
    <header className="fin-heading"><div><span className="fin-eyebrow"><ShieldCheck size={13} /> Exclusivo do dono</span><h1>Financeiro da Vizantu</h1><p>Quanto os contratos valem, até quando, e o que sobra. Cobrança e recebimento ficam no Asaas.</p></div>
      <div className="fin-actions"><MonthFilter month={month} onChange={setMonth} /><Button variant="secondary" onClick={load} disabled={loading || busy} aria-label="Atualizar financeiro"><RefreshCw size={15} /></Button><Button onClick={() => createRevenue()} disabled={!data}><Plus size={15} /> Novo lançamento</Button></div>
    </header>
    <nav className="fin-tabs" aria-label="Seções do financeiro">{TABS.map((item) => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
    {error ? <div className="fin-message is-error" role="alert">{error}<button onClick={load} disabled={loading}>Tentar novamente</button></div> : null}
    {notice ? <p className="fin-message" role="status">{notice}</p> : null}
    {loading && !data ? <div className="fin-empty">{section === "production" ? "Carregando produção da equipe…" : "Carregando lançamentos e contratos…"}</div> : null}
    {data && stats ? <>
      {data.warnings.length ? <details className="fin-warning"><summary>{data.warnings.length} pendências na integração de contratos</summary><ul>{data.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details> : null}
      {data.settings.taxRate === null ? <div className="fin-warning">Configure a alíquota de imposto para calcular o resultado e os preços com margem. <button onClick={() => setTab("settings")}>Configurar <ChevronRight size={13} /></button></div> : null}
      {tab === "contracts" ? <Contracts data={data} month={month} busy={busy} onRevenue={createRevenue} onBlock={async (id, blocked, reason) => {
        if (await confirm({ title: blocked ? "Bloquear acesso ao plano" : "Desbloquear acesso", message: blocked ? "O cliente perderá o acesso ao plano, inclusive em sessões já abertas. Você poderá desbloqueá-lo aqui." : "O cliente poderá voltar a acessar o plano pelo mesmo link.", confirmLabel: blocked ? "Bloquear cliente" : "Desbloquear", danger: blocked })) await mutate({ action: "block", projectId: id, blocked, reason });
      }} /> : null}
      {tab === "oneoff" ? <OneOff data={data} month={month} onRevenue={createRevenue} /> : null}
      {tab === "overview" ? <Overview data={data} month={month} stats={stats} /> : null}
      {tab === "costs" ? <Costs data={data} month={month} busy={busy} onEdit={setEditEntry} onCancelSeries={async (entry) => { if (await confirm({ title: "Encerrar próximas parcelas", message: `Cancelar as parcelas a partir de ${entry.competence}?`, confirmLabel: "Encerrar recorrência", danger: true })) await mutate({ action: "cancelSeries", entryId: entry.id }); }} onCancel={async (entry) => { if (await confirm({ title: "Cancelar lançamento", message: `Cancelar “${entry.description}”? O histórico será mantido.`, confirmLabel: "Cancelar lançamento", danger: true })) await mutate({ action: "cancel", entryId: entry.id }); }} /> : null}
      {tab === "production" ? <Production data={data} month={month} busy={busy} onClose={async (memberId, name, pending, pieces) => {
        if (await confirm({ title: `Fechar o mês de ${name}`, message: `${pieces} peça(s), ${brl(pending)}. Cada uma vira uma despesa de produção na competência ${month}.`, confirmLabel: "Lançar fechamento" })) await mutate({ action: "productionClosing", memberId, competence: month });
      }} onBook={async (line) => {
        if (await confirm({ title: "Lançar produção a pagar", message: `${line.name}: ${brl(line.total)}. O valor e a regra aplicada serão registrados no financeiro.`, confirmLabel: "Lançar despesa" })) await mutate({ action: "production", taskId: line.taskId });
      }} /> : null}
      {tab === "settings" ? <SettingsPanel key={JSON.stringify(data.settings)} settings={data.settings} busy={busy} onSave={(settings) => mutate({ action: "settings", settings })} audit={data.audit} members={data.members} /> : null}
      {entryOpen ? <EntryForm data={data} projectId={entryProject} month={month} busy={busy} onClose={() => setEntryOpen(false)} onSave={async (payload) => { if (await mutate(payload)) setEntryOpen(false); }} error={error} /> : null}
      {editEntry ? <EditEntryForm entry={editEntry} busy={busy} error={error} onClose={() => setEditEntry(null)} onSave={async (payload) => { if (await mutate(payload)) setEditEntry(null); }} /> : null}
    </> : null}
    {ConfirmDialog}
  </main>;
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <article className={`fin-metric${accent ? " is-accent" : ""}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
function MonthFilter({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const move = (offset: number) => onChange(monthAdd(`${month}-01`, offset).slice(0, 7));
  return <div className="fin-period" aria-label={`Competência selecionada: ${monthLabel(month)}`}>
    <button type="button" onClick={() => move(-1)} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
    <label className="fin-month"><CalendarDays size={16} /><span><small>Competência</small><strong>{monthLabel(month)}</strong></span><input aria-label="Mês de análise" type="month" value={month} onChange={(e) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) onChange(e.target.value); }} /></label>
    <button type="button" onClick={() => move(1)} aria-label="Próximo mês"><ChevronRight size={16} /></button>
  </div>;
}
function Overview({ data, month, stats: s }: { data: FinanceData; month: string; stats: ReturnType<typeof metrics> }) {
  const [growth, setGrowth] = useState(5);
  const [churn, setChurn] = useState(0);
  const [horizon, setHorizon] = useState(6);
  const [scenarioCost, setScenarioCost] = useState<string>("");
  const forecast = growthProjection(s.mrr, scenarioCost === "" ? s.operatingCost + s.directCost + (s.tax || 0) : Math.max(0, money(scenarioCost) || 0), growth, churn, horizon);
  const max = Math.max(1, ...s.history.map((h) => Math.max(h.revenue, h.cost)));
  const rows: [string, number | null][] = [["Receita bruta", s.revenue], ["Impostos sobre receita", s.tax === null ? null : -s.tax], ["Receita líquida", s.tax === null ? null : s.revenue - s.tax], ["Produção da equipe", -s.directCost], ["Lucro bruto", s.grossProfit], ["Custo operacional", -s.costs.operacional], ["Ferramentas", -s.costs.ferramentas], ["Aquisição / marketing", -s.costs.marketing], ["Pró-labore", -s.costs.prolabore], ["Outros custos", -s.costs.outros_custos], ["Resultado gerencial", s.profit]];
  return <>
    <div className="fin-metrics"><Metric accent label="MRR" value={brl(s.mrr)} detail={`${s.clients} contratos recorrentes · exclui avulsos`} /><Metric label="Receita do mês" value={brl(s.revenue)} detail="Competência · recorrente e avulso" /><Metric label="Resultado gerencial" value={display(s.profit)} detail={`Margem: ${percent(s.margin)}`} /><Metric label="ARR" value={brl(s.arr)} detail="MRR × 12 · ritmo anual, sem garantia de renovação" /></div>
    <div className="fin-health"><div><span className="fin-health-dot" /><strong>Saúde financeira: {s.health}</strong></div><span>Considera resultado e margem-alvo por competência. Caixa e recebimento ficam no Asaas.</span></div>
    <section className="fin-panel"><div className="fin-panel-title"><div><span className="fin-eyebrow">Resultado por competência</span><h2>DRE gerencial</h2></div><Landmark size={20} /></div><dl className="fin-dre">{rows.map(([label, value], i) => <div key={label} className={[0, 4, 10].includes(i) ? "is-total" : ""}><dt>{label}</dt><dd className={value !== null && value < 0 ? "fin-negative" : ""}>{display(value)}</dd></div>)}</dl><p className="fin-footnote">Imposto lançado substitui a estimativa de {data.settings.taxRate ?? 0}%. Retiradas ({brl(s.costs.retiradas)}) não entram como despesa operacional. DRE gerencial simplificada; não substitui escrituração contábil.</p></section>
    <div className="fin-metrics"><Metric label="Ticket médio" value={display(s.ticket)} detail="Receita por cliente no mês" /><Metric label="ARPA recorrente" value={display(s.arpa)} detail="MRR ÷ contratos recorrentes" /><Metric label="Churn de clientes" value={percent(s.churn)} detail="Perda de recorrentes vs. mês anterior" /><Metric label="LTV estimado" value={display(s.ltv)} detail="ARPA × margem bruta ÷ churn; sem churn observado, sem estimativa" /><Metric label="CAC" value={display(s.cac)} detail="Aquisição no mês ÷ novos clientes recorrentes" /><Metric label="Ponto de equilíbrio" value={display(s.breakEven)} detail="Custo operacional ÷ margem de contribuição" /></div>
    <div className="fin-columns"><section className="fin-panel"><div className="fin-panel-title"><div><span className="fin-eyebrow">Últimos três meses</span><h2>Histórico e tendência</h2></div><TrendingUp size={20} /></div><div className="fin-chart" role="img" aria-label="Receita e despesas dos três meses anteriores">{s.history.map((h) => <div className="fin-chart-row" key={h.month}><span>{h.month}</span><div><i style={{ width: `${h.revenue / max * 100}%` }} /><i className="is-cost" style={{ width: `${h.cost / max * 100}%` }} /></div><small>{h.hasData ? `${brl(h.revenue)} / ${brl(h.cost)}` : "Sem dados"}</small></div>)}</div><p className="fin-footnote">Roxo: receita · cinza: despesas cadastradas. Meses sem registros não são tratados como zero.</p><div className="fin-mini-grid"><Metric label="Receita média mensal" value={display(s.averageRevenue)} detail="Base histórica para projeção" /><Metric label="Despesa média mensal" value={display(s.averageCost)} detail="Sem retiradas de lucro" /></div></section>
    <section className="fin-panel"><div className="fin-panel-title"><div><span className="fin-eyebrow">Simulação editável</span><h2>Calculadora de crescimento</h2></div><TrendingUp size={20} /></div><div className="fin-form-grid"><Field label="Crescimento mensal (%)"><input type="number" min="-100" max="100" value={growth} onChange={(e) => setGrowth(Math.max(-100, Math.min(100, Number(e.target.value))))} /></Field><Field label="Churn mensal (%)"><input type="number" min="0" max="100" value={churn} onChange={(e) => setChurn(Math.max(0, Math.min(100, Number(e.target.value))))} /></Field><Field label="Meses"><input type="number" min="1" max="24" value={horizon} onChange={(e) => setHorizon(Math.max(1, Math.min(24, Number(e.target.value))))} /></Field><Field label="Custo mensal do cenário (R$)"><input inputMode="decimal" placeholder={inputMoney(s.operatingCost + s.directCost + (s.tax || 0))} value={scenarioCost} onChange={(e) => setScenarioCost(e.target.value)} /></Field></div><div className="fin-table-scroll"><table className="fin-table"><thead><tr><th>Mês</th><th>Receita simulada</th><th>Custo simulado</th><th>Saldo do cenário</th></tr></thead><tbody>{forecast.map((row) => <tr key={row.period}><td>{monthAdd(`${month}-01`, row.period).slice(0, 7)}</td><td>{brl(row.revenue)}</td><td>{brl(row.cost)}</td><td>{brl(row.result)}</td></tr>)}</tbody></table></div><p className="fin-footnote">Parte do MRR de {brl(s.mrr)}. Aplica crescimento e churn compostos sobre um custo mensal fixo. É simulação: exige capacidade de produção e renovação para se realizar.</p></section></div>
  </>;
}

function Costs({ data, month, busy, onCancel, onEdit, onCancelSeries }: { data: FinanceData; month: string; busy: boolean; onCancel: (entry: Entry) => void; onEdit: (entry: Entry) => void; onCancelSeries: (entry: Entry) => void }) {
  const [category, setCategory] = useState("all"); const [allMonths, setAllMonths] = useState(false);
  const entries = data.entries.filter((e) => e.direction === "expense" && (allMonths || e.competence === month) && (category === "all" || e.category === category)).sort((a, b) => a.competence.localeCompare(b.competence) || a.description.localeCompare(b.description));
  const total = entries.filter((e) => !e.cancelled).reduce((sum, e) => sum + e.amount, 0);
  function exportCsv() {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const rows = [["Descrição", "Categoria", "Cliente", "Responsável", "Competência", "Valor", "Cancelado"], ...entries.map((e) => [e.description, CATEGORIES[e.category], data.projects.find((p) => p.id === e.projectId)?.name || "", data.members.find((m) => m.id === e.memberId)?.name || "", e.competence, inputMoney(e.amount), e.cancelled ? "Sim" : "Não"])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `vizantu-custos-${month}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="fin-panel"><div className="fin-panel-title"><div><span className="fin-eyebrow">O que a operação custa</span><h2>Custos · {brl(total)}</h2></div><Button variant="secondary" onClick={exportCsv}><Download size={14} /> Exportar CSV</Button></div>
    <div className="fin-filters"><select aria-label="Categoria de custo" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Todas as categorias</option>{Object.entries(CATEGORIES).filter(([key]) => !["servicos", "campanha", "outras_receitas"].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label><input type="checkbox" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} /> Todos os meses</label></div>
    <div className="fin-table-scroll"><table className="fin-table"><thead><tr><th>Custo</th><th>Cliente / responsável</th><th>Competência</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td><strong>{entry.description}</strong><small>{CATEGORIES[entry.category]}{entry.recurring ? " · recorrente" : ""}</small>{entry.cancelled ? <span className="fin-badge">Cancelado</span> : null}{entry.notes ? <details><summary>Observações</summary><small>{entry.notes}</small></details> : null}</td><td>{data.projects.find((p) => p.id === entry.projectId)?.name || "Vizantu"}<small>{data.members.find((m) => m.id === entry.memberId)?.name}</small></td><td>{entry.competence}</td><td className="fin-negative">− {brl(entry.amount)}</td><td><div className="fin-row-actions">{!entry.cancelled ? <><button disabled={busy} onClick={() => onEdit(entry)}>Editar</button><button disabled={busy} onClick={() => onCancel(entry)}>Cancelar</button>{entry.seriesId ? <button disabled={busy} onClick={() => onCancelSeries(entry)}>Encerrar próximas</button> : null}</> : null}</div></td></tr>)}</tbody></table></div>
    {!entries.length ? <Empty text="Nenhum custo nesta competência. Cadastre ferramentas, operacional, pró-labore ou lance a produção da equipe." /> : null}
    <p className="fin-footnote">Custos entram por competência. Quando o dinheiro sai da conta é assunto do banco, não deste painel.</p>
  </section>;
}

// Receita que não se repete: campanha, projeto fechado, trabalho pontual. Fica
// separada dos contratos de propósito — somar as duas numa lista só faz um mês
// bom de campanha parecer carteira recorrente, e é assim que se superestima MRR.
function OneOff({ data, month, onRevenue }: { data: FinanceData; month: string; onRevenue: (id?: string) => void }) {
  const [allMonths, setAllMonths] = useState(false);
  const entries = data.entries.filter((e) => e.direction === "income" && !e.recurring && !e.cancelled && (allMonths || e.competence === month)).sort((a, b) => a.competence.localeCompare(b.competence));
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  return <section className="fin-panel"><div className="fin-panel-title"><div><span className="fin-eyebrow">Receita esporádica</span><h2>Avulsos · {brl(total)}</h2></div><Button variant="secondary" onClick={() => onRevenue()}><Plus size={14} /> Nova receita avulsa</Button></div>
    <div className="fin-filters"><label><input type="checkbox" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} /> Todos os meses</label></div>
    <div className="fin-table-scroll"><table className="fin-table"><thead><tr><th>Receita</th><th>Cliente</th><th>Competência</th><th>Valor</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td><strong>{entry.description}</strong><small>{CATEGORIES[entry.category]}</small>{entry.notes ? <details><summary>Observações</summary><small>{entry.notes}</small></details> : null}</td><td>{data.projects.find((p) => p.id === entry.projectId)?.name || "Sem cliente"}</td><td>{entry.competence}</td><td>+ {brl(entry.amount)}</td></tr>)}</tbody></table></div>
    {!entries.length ? <Empty text="Nenhuma receita avulsa nesta competência." /> : null}
    <p className="fin-footnote">Avulso não entra no MRR nem na conta de churn. Campanha parcelada continua sendo avulsa: parcelar não transforma um trabalho pontual em recorrência.</p>
  </section>;
}

// ---------- Contratos ----------
//
// A tela principal do financeiro. Responde três perguntas, nessa ordem: quanto
// cada contrato vale por mês, até quando ele vale, e quanto ainda falta entrar.
//
// Só aparece quem tem contrato recorrente. Projeto sem receita recorrente
// cadastrada não é carteira — é projeto —, e listar todos fazia a tela virar um
// diretório de clientes com zeros no lugar de uma carteira.
function Contracts({ data, month, busy, onRevenue, onBlock }: { data: FinanceData; month: string; busy: boolean; onRevenue: (id: string) => void; onBlock: (id: string, blocked: boolean, reason: string) => void }) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [premium, setPremium] = useState(5);
  const [costs, setCosts] = useState<Record<string, string>>({});
  const resumos = contractSummaries(data.entries, month);
  const margens = clientMargins(data, month);
  const meses = contractedByMonth(data.entries, month, 12);
  const alertas = contractAlerts(data.contracts, today());
  const projeto = (id: string) => data.projects.find((p) => p.id === id);
  const latestScores = new Map<string, number>();
  for (const score of [...data.scores].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) latestScores.set(score.projectId, score.score);
  const scores = [...latestScores.values()];
  const satisfactionIndex = scores.length ? Math.round(100 * (scores.filter((score) => score >= 9).length - scores.filter((score) => score <= 6).length) / scores.length) : null;
  const mensal = resumos.reduce((total, resumo) => total + resumo.monthly, 0);
  const aContratar = resumos.reduce((total, resumo) => total + resumo.remaining, 0);
  return <>
    <div className="fin-metrics"><Metric accent label="Contratado por mês" value={brl(mensal)} detail={`${resumos.length} contratos ativos em ${month}`} /><Metric label="Falta entrar até o fim" value={brl(aContratar)} detail="Soma das competências daqui para a frente" /><Metric label="Ticket médio do contrato" value={resumos.length ? brl(Math.round(mensal / resumos.length)) : "—"} detail="Valor mensal ÷ contratos ativos" /><Metric label="Índice de satisfação (modelo NPS)" value={satisfactionIndex === null ? "—" : String(satisfactionIndex)} detail={`${scores.length} clientes avaliados · % notas 9–10 menos % 0–6`} /></div>
    {alertas.length ? <div className="fin-warning">{alertas.length} contrato(s) terminando em até 30 dias: {alertas.map((alerta) => `${projeto(alerta.projectId || "")?.name || alerta.title} (${alerta.endsOn})`).join(", ")}.</div> : null}

    <section className="fin-panel"><div className="fin-panel-title"><div><span className="fin-eyebrow">Quanto vale e até quando</span><h2>Contratos ativos</h2></div><FileSignature size={20} /></div>
      <div className="fin-table-scroll"><table className="fin-table"><thead><tr><th>Cliente</th><th>Contrato</th><th>Por mês</th><th>Começou</th><th>Acaba em</th><th>Meses restantes</th><th>Falta entrar</th></tr></thead><tbody>{resumos.map((resumo) => <tr key={resumo.seriesId}><td><strong>{projeto(resumo.projectId)?.name || "Sem cliente"}</strong></td><td>{resumo.description}</td><td><strong>{brl(resumo.monthly)}</strong></td><td>{resumo.first}</td><td>{resumo.last}</td><td className={resumo.monthsLeft <= 1 ? "fin-negative" : ""}>{resumo.monthsLeft}</td><td>{brl(resumo.remaining)}</td></tr>)}</tbody></table></div>
      {!resumos.length ? <Empty text="Nenhum contrato recorrente cadastrado. Crie uma receita marcada como recorrente ou complete um contrato assinado." /> : null}
      <p className="fin-footnote">“Acaba em” é a última competência cadastrada da série, e “falta entrar” soma as competências daqui para a frente. Não presume renovação: contrato que termina some do mês seguinte, e é para sumir.</p>
    </section>

    <section className="fin-panel"><div className="fin-panel-title"><div><span className="fin-eyebrow">Os próximos doze meses</span><h2>Contratado mês a mês</h2></div><CalendarDays size={20} /></div>
      <div className="fin-table-scroll"><table className="fin-table"><thead><tr><th>Mês</th><th>Recorrente</th><th>Avulso</th><th>Total</th></tr></thead><tbody>{meses.map((linha) => <tr key={linha.month}><td>{linha.month}</td><td>{brl(linha.recurring)}</td><td>{linha.oneOff ? brl(linha.oneOff) : "—"}</td><td><strong>{brl(linha.recurring + linha.oneOff)}</strong></td></tr>)}</tbody></table></div>
      <p className="fin-footnote">Só o que já está cadastrado. A queda a partir de um mês qualquer é contrato terminando, não erro de conta.</p>
    </section>

    <section className="fin-panel"><div className="fin-panel-title"><div><span className="fin-eyebrow">Resultado por cliente</span><h2>Margem e acesso</h2></div><LockKeyhole size={20} /></div>
      <Field label="Acréscimo simulado para nota 9–10 (%)"><input type="number" min="0" max="100" value={premium} onChange={(e) => setPremium(Math.max(0, Math.min(100, Number(e.target.value))))} /></Field>
      <div className="fin-client-grid">{resumos.map((resumo) => {
        const project = projeto(resumo.projectId);
        if (!project) return null;
        const block = data.blocks.find((b) => b.projectId === project.id);
        const score = [...data.scores].filter((s) => s.projectId === project.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.score ?? null;
        const margem = margens.find((linha) => linha.projectId === project.id)!;
        const rawCost = costs[project.id]; const cost = rawCost === undefined ? margem.production + margem.tools : money(rawCost);
        const pricing = priceSuggestion(cost, data.settings.taxRate, data.settings.targetMargin, score, premium);
        return <article className="fin-client" key={project.id}><header><h3>{project.name}</h3><span className={`fin-badge ${block?.blocked ? "is-late" : "is-ok"}`}>{block?.blocked ? "Plano bloqueado" : "Acesso liberado"}</span></header>
          <dl><div><dt>Receita no mês</dt><dd>{brl(margem.revenue)}</dd></div><div><dt>Imposto</dt><dd>{margem.tax === null ? "—" : `− ${brl(margem.tax)}`}</dd></div><div><dt>Produção da equipe</dt><dd>{margem.production ? `− ${brl(margem.production)}` : "—"}</dd></div><div><dt>Ferramentas (rateio)</dt><dd>{margem.tools ? `− ${brl(margem.tools)}` : "—"}</dd></div><div><dt>Resultado do cliente</dt><dd className={margem.result !== null && margem.result < 0 ? "fin-negative" : ""}>{margem.result === null ? "Falta alíquota" : brl(margem.result)}</dd></div><div><dt>Margem</dt><dd className={margem.margin !== null && margem.margin < 0 ? "fin-negative" : ""}>{margem.margin === null ? "—" : `${Math.round(margem.margin * 100)}%`}</dd></div><div><dt>Nota do cliente</dt><dd>{score === null ? "Sem resposta" : `${score}/10`}</dd></div></dl>
          <details><summary>Preço por custo, margem e satisfação</summary><Field label="Custo mensal do cliente (R$)"><input inputMode="decimal" value={rawCost ?? inputMoney(cost)} onChange={(e) => setCosts({ ...costs, [project.id]: e.target.value })} /></Field><p>Preço-base: <strong>{pricing ? brl(pricing.floor) : "Informe custo e imposto"}</strong><br />Sugestão: <strong>{pricing ? brl(pricing.suggested) : "—"}</strong></p><p className="fin-footnote">{pricing?.note} O custo nasce com produção lançada e rateio de ferramentas pela participação do cliente na receita do mês. Operacional, marketing e pró-labore ficam de fora: são custo de existir a empresa, não de atender este cliente.</p></details>
          <Button variant="secondary" size="sm" onClick={() => onRevenue(project.id)}><Plus size={13} /> Cadastrar valor / receita</Button>
          <div className="fin-client-block">{block?.blocked ? <><small>{block.reason}</small><button disabled={busy} onClick={() => onBlock(project.id, false, "")}>Desbloquear cliente</button></> : <><input aria-label={`Motivo do bloqueio de ${project.name}`} placeholder="Motivo do bloqueio" value={reasons[project.id] || ""} onChange={(e) => setReasons({ ...reasons, [project.id]: e.target.value })} /><button disabled={busy || !reasons[project.id]?.trim()} onClick={() => onBlock(project.id, true, reasons[project.id])}>Bloquear acesso ao plano</button></>}</div>
        </article>;
      })}</div>
      <p className="fin-footnote">O bloqueio é manual e derruba o acesso ao plano na hora, inclusive em sessões já abertas. Quem sabe se o cliente pagou é você, com o Asaas na outra aba — o motivo escrito fica registrado na auditoria. Pagar não desbloqueia sozinho.</p>
    </section>
  </>;
}

type SelectedFinanceTask = { line: ProductionLine; task: Task; loading: boolean; error: string };

function Production({ data, month, busy, onBook, onClose }: { data: FinanceData; month: string; busy: boolean; onBook: (line: ProductionLine) => void; onClose: (memberId: string, name: string, pending: number, pieces: number) => void }) {
  const [member, setMember] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");
  const [selected, setSelected] = useState<SelectedFinanceTask | null>(null);
  const allLines = useMemo(() => productionLines(data.tasks, data.tags, data.settings, data.members), [data]);
  const monthLines = allLines.filter((line) => line.counted && line.deliveredDate?.startsWith(month));
  const roster = productionRoster(allLines, data.entries, data.members, month);
  const closings = producerClosing(monthLines, data.entries);
  const visibleClosings = member ? closings.filter((closing) => closing.producerId === member) : closings;
  const withoutCreativeOwner = monthLines.filter((line) => !line.producerId);
  const withoutComputedDate = allLines.filter((line) => ["aprovado", "finalizado"].includes(line.taskStatus || "") && !line.deliveredDate);
  const team = roster.reduce((summary, person) => ({ delivered: summary.delivered + person.delivered, inProgress: summary.inProgress + person.inProgress, total: summary.total + person.total, pending: summary.pending + person.pending }), { delivered: 0, inProgress: 0, total: 0, pending: 0 });

  const viewMember = (memberId: string) => {
    setMember(memberId);
    document.getElementById("production-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  async function exportStatement(closing: ReturnType<typeof producerClosing>[number]) {
    if (exporting) return;
    setExporting(closing.producerId); setExportError("");
    try {
      const tasks: Task[] = [];
      // Fetch full details in bounded batches; never silently export an incomplete statement.
      for (let index = 0; index < closing.lines.length; index += 5) {
        const details = await Promise.all(closing.lines.slice(index, index + 5).map(async (line) => {
          const response = await fetch(`/api/tasks/${encodeURIComponent(line.taskId)}?detail=1`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
          if (!response.ok) throw new Error(await responseError(response, "carregar os detalhes do extrato"));
          const result = await response.json() as { task: Task };
          if (!result.task || result.task.id !== line.taskId) throw new Error("Não foi possível conferir todos os trabalhos. Atualize o financeiro e tente novamente.");
          return result.task;
        }));
        tasks.push(...details);
      }
      const { buildStatementPdf } = await import("@/lib/finance/statement-pdf");
      const { loadStatementAssets } = await import("@/lib/finance/statement-assets");
      const assets = await loadStatementAssets();
      const { pdf, filename } = buildStatementPdf(data, closing, tasks, month, window.location.origin, assets);
      await pdf.save(filename, { returnPromise: true });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Não foi possível gerar o PDF. Tente novamente.");
    } finally { setExporting(null); }
  }
  async function openTask(line: ProductionLine) {
    const fallback = data.tasks.find((task) => task.id === line.taskId);
    if (!fallback) return;
    setSelected({ line, task: fallback, loading: true, error: "" });
    try {
      const response = await fetch(`/api/tasks/${line.taskId}?detail=1`, { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response, "abrir a tarefa"));
      const result = await response.json() as { task: Task };
      setSelected((current) => current?.line.taskId === line.taskId ? { line, task: result.task, loading: false, error: "" } : current);
    } catch (error) {
      setSelected((current) => current?.line.taskId === line.taskId ? { ...current, loading: false, error: error instanceof Error ? error.message : "Não foi possível atualizar os detalhes da tarefa." } : current);
    }
  }

  return <>
    <section className="fin-production-dashboard" aria-labelledby="creative-team-title">
      <div className="fin-panel-title"><div><span className="fin-eyebrow">Visão rápida · {monthLabel(month)}</span><h2 id="creative-team-title">Painel da equipe criativa</h2><p>Conta somente tarefas atualmente aprovadas ou finalizadas, sempre para o responsável atual.</p></div><Users size={20} /></div>
      <div className="fin-production-rule"><Check size={15} /><span><strong>Regra do financeiro:</strong> Aprovado ou Finalizado + responsável atual. Tarefas em Problema não entram.</span></div>
      <div className="fin-production-summary"><Metric accent label="Demandas computadas" value={String(team.delivered)} detail={`${roster.length} diretor(es) criativo(s)`} /><Metric label="Valor apurado" value={brl(team.total)} detail="Pela tabela de produção" /><Metric label="Falta lançar" value={brl(team.pending)} detail="Ainda não virou despesa" /><Metric label="Em andamento agora" value={String(team.inProgress)} detail="Fora do fechamento do mês" /></div>
      <div className="fin-creative-grid">{roster.map((person) => {
        const profile = data.members.find((candidate) => candidate.id === person.memberId);
        return <article className="fin-creative-card" key={person.memberId}>
          <header><Avatar name={person.name} imageUrl={profile?.avatarUrl} size={38} /><div><h3>{person.name}</h3><span>{person.active ? "Diretor criativo" : "Inativo · histórico preservado"}</span></div><strong>{brl(person.total)}</strong></header>
          <dl><div><dt>Computadas</dt><dd>{person.delivered}</dd></div><div><dt>Em andamento</dt><dd>{person.inProgress}</dd></div><div><dt>Sem valor</dt><dd>{person.unpriced}</dd></div><div><dt>Falta lançar</dt><dd>{brl(person.pending)}</dd></div></dl>
          <footer><span>{person.lastDelivery ? `Última aprovação: ${dateLabel(person.lastDelivery)}` : `Sem demanda em ${monthLabel(month)}`}</span><Button size="sm" variant="secondary" onClick={() => viewMember(person.memberId)}>Ver demandas</Button></footer>
        </article>;
      })}</div>
      {!roster.length ? <Empty text="Nenhum diretor criativo cadastrado." /> : null}
    </section>

    {withoutCreativeOwner.length ? <div className="fin-warning">{withoutCreativeOwner.length} tarefa(s) aprovada(s) ou finalizada(s) sem um diretor criativo como responsável atual. Elas não geram pagamento para ninguém.</div> : null}
    {withoutComputedDate.length ? <div className="fin-warning">{withoutComputedDate.length} tarefa(s) aprovada(s) ou finalizada(s) sem data registrada da mudança de status. Elas não foram atribuídas a nenhuma competência.</div> : null}

    <div id="production-details" className="fin-production-list-head"><div><span className="fin-eyebrow">Demandas computadas · {monthLabel(month)}</span><h2>O que cada pessoa fez</h2></div><select aria-label="Filtrar diretor criativo" value={member} onChange={(event) => setMember(event.target.value)}><option value="">Toda a equipe criativa</option>{roster.map((person) => <option key={person.memberId} value={person.memberId}>{person.name}</option>)}</select></div>
    {exportError ? <p className="fin-message is-error" role="alert">{exportError}</p> : null}
    {visibleClosings.map((closing) => {
      const person = data.members.find((candidate) => candidate.id === closing.producerId);
      return <section className="fin-panel" key={closing.producerId}>
        <div className="fin-panel-title"><div><span className="fin-eyebrow">Responsável atual</span><h2>{person?.name || "Sem diretor criativo"} · {closing.pieces} demanda(s)</h2></div>
          <Button variant="secondary" disabled={busy || exporting !== null} onClick={() => void exportStatement(closing)} aria-label={`Exportar extrato PDF de ${person?.name || "diretor criativo"}` }><Download size={15} /> {exporting === closing.producerId ? "Gerando PDF…" : "Exportar extrato PDF"}</Button>
          {closing.pending ? <Button disabled={busy} onClick={() => onClose(closing.producerId, person?.name || "", closing.pending, closing.pendingTaskIds.length)}><Check size={15} /> Lançar {closing.pendingTaskIds.length} pendente(s)</Button> : <span className="fin-badge is-ok">Valores lançados</span>}
        </div>
        <div className="fin-mini-grid"><Metric label="Valor computado" value={brl(closing.total)} detail={`${closing.pieces} tarefa(s) aprovada(s) ou finalizada(s)`} /><Metric label="Já lançado" value={brl(closing.launched)} detail="Valor gravado como despesa" /><Metric label="Falta lançar" value={brl(closing.pending)} detail="Estimativa pela tabela atual" /><Metric label="Sem valor calculado" value={String(closing.unpriced)} detail="Formato não reconhecido" /></div>
        <div className="fin-table-scroll"><table className="fin-table fin-production-table"><thead><tr><th>Demanda</th><th>Cliente</th><th>Status atual</th><th>Data computada</th><th>Valor</th><th>Situação</th></tr></thead><tbody>{closing.lines.map((line) => {
          const entry = data.entries.find((item) => item.sourceKey === `production:${line.taskId}` && !item.cancelled);
          const status = TASK_STATUSES.find((item) => item.value === line.taskStatus)?.label || line.taskStatus;
          return <tr key={line.taskId}>
            <td><button type="button" className="fin-task-link" onClick={() => void openTask(line)}><Eye size={14} /><span><strong>{line.name}</strong><small>{line.rateKey ? RATE_LABELS[line.rateKey] : "Formato não reconhecido"}</small></span></button></td>
            <td>{data.projects.find((project) => project.id === line.projectId)?.name || "—"}</td>
            <td><span className="fin-badge is-ok">{status}</span></td>
            <td>{line.deliveredDate ? dateLabel(line.deliveredDate) : "—"}</td>
            <td><strong>{line.ready ? brl(entry ? entry.amount : line.total) : "—"}</strong>{line.ready ? <small>{entry ? "Valor lançado" : line.penalty ? "50% pela regra de prazo" : "Valor calculado"}</small> : <small className="fin-negative">{line.pendencia}</small>}</td>
            <td>{entry ? <span className="fin-badge">Lançada</span> : line.ready ? <Button size="sm" onClick={() => onBook(line)} disabled={busy}>Lançar a pagar</Button> : <span className="fin-badge">Sem valor</span>}</td>
          </tr>;
        })}</tbody></table></div>
        <p className="fin-footnote">Clique no nome da demanda para abrir a tarefa dentro do Financeiro. A pessoa exibida aqui é sempre o responsável atual da tarefa. O PDF inclui todas as demandas desta pessoa na competência selecionada, com links e tempo registrado em criação.</p>
      </section>;
    })}
    {!visibleClosings.length ? <Empty text={member ? "Esta pessoa não tem tarefas aprovadas ou finalizadas nesta competência." : "Nenhuma tarefa aprovada ou finalizada nesta competência."} /> : null}

    <section className="fin-panel"><div className="fin-panel-title"><div><span className="fin-eyebrow">Valores da produção</span><h2>Tabela da equipe</h2></div><BadgeDollarSign size={20} /></div><div className="fin-table-scroll"><table className="fin-table"><thead><tr><th>Entrega</th><th>Unidade</th><th>Pacote de 5</th></tr></thead><tbody>{Object.entries(data.settings.rates).map(([key, rate]) => <tr key={key}><td>{RATE_LABELS[key as RateKey]}</td><td>{brl(rate.unit)}</td><td>{rate.pack === null ? "—" : brl(rate.pack)}</td></tr>)}</tbody></table></div><p className="fin-footnote">O valor é calculado automaticamente pelo formato da tarefa. Grupos de cinco no mesmo pacote, formato e responsável atual recebem preço de pacote; excedentes usam preço unitário.</p></section>
    {selected ? <FinanceTaskDialog selected={selected} data={data} onClose={() => setSelected(null)} /> : null}
  </>;
}

function FinanceTaskDialog({ selected, data, onClose }: { selected: SelectedFinanceTask; data: FinanceData; onClose: () => void }) {
  const { task, line, loading, error } = selected;
  const project = data.projects.find((item) => item.id === task.projectId);
  const assignee = data.members.find((item) => item.id === task.assigneeId);
  const status = TASK_STATUSES.find((item) => item.value === task.status)?.label || task.status;
  const tags = [...task.formatTagIds, ...task.channelTagIds, ...task.categoryTagIds].map((id) => data.tags.find((tag) => tag.id === id)?.label).filter(Boolean);
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="fin-task-modal" showCloseButton={false}>
    <header><div><span className="fin-eyebrow">Tarefa computada no financeiro</span><DialogTitle>{task.name}</DialogTitle></div><button type="button" onClick={onClose} aria-label="Fechar detalhes da tarefa"><X size={20} /></button></header>
    {loading ? <p className="fin-task-loading">Atualizando os dados da tarefa…</p> : null}
    {error ? <p className="fin-message is-error" role="alert">{error} Os dados resumidos continuam visíveis abaixo.</p> : null}
    <div className="fin-task-facts"><div><span>Cliente</span><strong>{project?.name || "—"}</strong></div><div><span>Responsável atual</span><strong>{assignee?.name || "Sem responsável"}</strong></div><div><span>Status atual</span><strong>{status}</strong></div><div><span>Computada em</span><strong>{line.deliveredDate ? dateLabel(line.deliveredDate) : "Sem data"}</strong></div><div><span>Valor</span><strong>{line.ready ? brl(line.total) : "Sem valor calculado"}</strong></div><div><span>Prazo original</span><strong>{task.dueDate ? dateLabel(task.dueDate) : dateLabel(line.dueDate)}</strong></div></div>
    {tags.length ? <div className="fin-task-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
    <section className="fin-task-description"><h3>Descrição da tarefa</h3><div>{task.description?.trim() ? renderMarkdownLite(task.description) : <span className="fin-task-empty">Sem descrição cadastrada.</span>}</div></section>
    {task.images.length ? <section className="fin-task-images"><h3>Imagens</h3><div>{task.images.map((url) => <a href={url} target="_blank" rel="noreferrer" key={url}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Anexo da tarefa" />
    </a>)}</div></section> : null}
    {task.driveLink ? <a className="fin-task-drive" href={task.driveLink} target="_blank" rel="noreferrer"><Link2 size={15} /> Abrir material no Drive</a> : null}
    <footer><Button variant="secondary" onClick={onClose}>Fechar</Button></footer>
  </DialogContent></Dialog>;
}

function SettingsPanel({ settings, busy, onSave, audit, members }: { settings: Settings; busy: boolean; onSave: (settings: Settings) => Promise<boolean>; audit: FinanceData["audit"]; members: FinanceData["members"] }) {
  const [draft, setDraft] = useState(settings);
  const patch = (values: Partial<Settings>) => setDraft((current) => ({ ...current, ...values }));
  return <><form className="fin-panel" onSubmit={(e) => { e.preventDefault(); void onSave(draft); }}><div className="fin-panel-title"><div><span className="fin-eyebrow">Premissas da empresa</span><h2>Impostos, contratos e produção</h2></div><Settings2 size={20} /></div><div className="fin-form-grid">
    <Field label="Regime tributário"><input value={draft.taxRegime} onChange={(e) => patch({ taxRegime: e.target.value })} placeholder="Informe com sua contabilidade" /></Field><Field label="Alíquota efetiva (%)"><input type="number" min="0" max="99.99" step="0.01" value={draft.taxRate ?? ""} onChange={(e) => patch({ taxRate: e.target.value === "" ? null : Number(e.target.value) })} /></Field><Field label="Margem-alvo (%)"><input type="number" min="0" max="99" value={draft.targetMargin} onChange={(e) => patch({ targetMargin: Number(e.target.value) })} /></Field><Field label="Reajuste anual de contrato (%)"><input type="number" min="0" max="100" step="0.01" value={draft.annualAdjustment} onChange={(e) => patch({ annualAdjustment: Number(e.target.value) })} /></Field>
    <Field label="Contagem de prazo"><select value={draft.deadlineMode} onChange={(e) => patch({ deadlineMode: e.target.value as Settings["deadlineMode"] })}><option value="calendar">Dias corridos</option><option value="business">Dias úteis (seg–sex)</option></select></Field><Field label="Reduzir pagamento para 50% quando"><select value={draft.penaltyMode} onChange={(e) => patch({ penaltyMode: e.target.value as Settings["penaltyMode"] })}><option value="both">Atrasar E houver problema</option><option value="either">Atrasar OU houver problema</option></select></Field><Field label="Prazo avulso (dias)"><input type="number" min="0" max="365" value={draft.soloDays} onChange={(e) => patch({ soloDays: Number(e.target.value) })} /></Field><Field label="Prazo em pacote (dias)"><input type="number" min="0" max="365" value={draft.packageDays} onChange={(e) => patch({ packageDays: Number(e.target.value) })} /></Field><Field label="Card adicional (R$)"><input type="number" min="0.01" step="0.01" value={draft.extraCard / 100} onChange={(e) => patch({ extraCard: Math.round(Number(e.target.value) * 100) })} /></Field>
    </div><h3>Tabela de produção</h3><div className="fin-table-scroll"><table className="fin-table"><thead><tr><th>Entrega</th><th>Unidade (R$)</th><th>Pacote de 5 (R$)</th></tr></thead><tbody>{Object.entries(draft.rates).map(([key, rate]) => <tr key={key}><td>{RATE_LABELS[key as RateKey]}</td><td><input aria-label={`Preço unitário ${RATE_LABELS[key as RateKey]}`} type="number" min="0.01" step="0.01" value={rate.unit / 100} onChange={(e) => patch({ rates: { ...draft.rates, [key]: { ...rate, unit: Math.round(Number(e.target.value) * 100) } } })} /></td><td>{rate.pack === null ? "Não se aplica" : <input aria-label={`Preço pacote ${RATE_LABELS[key as RateKey]}`} type="number" min="0.01" step="0.01" value={rate.pack / 100} onChange={(e) => patch({ rates: { ...draft.rates, [key]: { ...rate, pack: Math.round(Number(e.target.value) * 100) } } })} />}</td></tr>)}</tbody></table></div><p className="fin-footnote">Mudanças recalculam estimativas. Despesas de produção já lançadas mantêm o valor registrado.</p><Button disabled={busy} type="submit"><Check size={15} /> Salvar configurações</Button></form>
    <section className="fin-panel"><h2>Histórico de alterações</h2><div className="fin-table-scroll"><table className="fin-table"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th></tr></thead><tbody>{audit.map((event) => <tr key={event.id}><td>{new Date(event.createdAt).toLocaleString("pt-BR")}</td><td>{members.find((m) => m.id === event.actorId)?.name || "Sistema"}</td><td>{event.action.replace("finance_entries", "Lançamento").replace("finance_settings", "Configuração").replace("finance_project_blocks", "Acesso do cliente").replace("finance_production_reviews", "Ajuste antigo de produção").replace(":INSERT", " · criação").replace(":UPDATE", " · alteração").replace(":DELETE", " · exclusão")}</td></tr>)}</tbody></table></div>{!audit.length ? <Empty text="As alterações financeiras ficarão registradas aqui." /> : null}</section></>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="fin-field"><span>{label}</span>{children}</label>; }
function Empty({ text }: { text: string }) { return <div className="fin-empty">{text}</div>; }
function FormShell({ title, children, onClose, busy, error }: { title: string; children: React.ReactNode; onClose: () => void; busy: boolean; error?: string }) {
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="fin-modal" showCloseButton={false}><header><DialogTitle>{title}</DialogTitle><button type="button" onClick={onClose} disabled={busy} aria-label="Fechar"><X size={20} /></button></header>{error ? <p className="fin-message is-error" role="alert">{error}</p> : null}{children}</DialogContent></Dialog>;
}
function EntryForm({ data, projectId, month, busy, onSave, onClose, error }: { data: FinanceData; projectId: string; month: string; busy: boolean; onSave: (payload: Record<string, unknown>) => void; onClose: () => void; error: string }) {
  const [direction, setDirection] = useState("income"); const [category, setCategory] = useState("servicos"); const [recurring, setRecurring] = useState(true); const [requestId] = useState(() => crypto.randomUUID());
  return <FormShell title="Novo lançamento" onClose={onClose} busy={busy} error={error}><form onSubmit={(e) => {
    e.preventDefault(); const fields = new FormData(e.currentTarget); onSave({ ...Object.fromEntries(fields), action: "entry", direction, category, amount: money(String(fields.get("amount"))), months: Number(fields.get("months")), recurring: fields.get("recurring") === "on", requestId });
  }}><div className="fin-form-grid"><Field label="Tipo"><select value={direction} onChange={(e) => { setDirection(e.target.value); setCategory(e.target.value === "income" ? "servicos" : "operacional"); setRecurring(e.target.value === "income"); }}><option value="income">Receita</option><option value="expense">Despesa</option></select></Field><Field label="Categoria"><select value={category} onChange={(e) => { setCategory(e.target.value); setRecurring(e.target.value === "servicos"); }}>{Object.entries(CATEGORIES).filter(([key]) => (direction === "income") === ["servicos", "campanha", "outras_receitas"].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Descrição"><input name="description" required maxLength={500} placeholder="Mensalidade, campanha, licença…" /></Field><Field label="Valor por parcela (R$)"><input name="amount" required inputMode="decimal" placeholder="0,00" /></Field><Field label="Projeto / cliente"><select name="projectId" defaultValue={projectId}><option value="">Vizantu / sem cliente</option>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Responsável / favorecido"><select name="memberId"><option value="">Não se aplica</option>{data.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field><Field label="Primeira competência"><input type="month" name="competence" required defaultValue={month} /></Field><Field label="Quantidade de meses / parcelas"><input name="months" type="number" min="1" max="120" defaultValue="1" required /></Field><label className="fin-check"><input name="recurring" type="checkbox" checked={direction === "income" && recurring} disabled={direction !== "income"} onChange={(e) => setRecurring(e.target.checked)} /> Receita recorrente (entra no MRR)</label></div><Field label="Observações"><textarea name="notes" maxLength={2000} rows={3} /></Field><p className="fin-footnote">O valor informado se repete mensalmente pelo prazo escolhido. Campanhas parceladas não devem ser marcadas como recorrentes.</p><footer><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Criar lançamento"}</Button></footer></form></FormShell>;
}
function EditEntryForm({ entry, busy, error, onClose, onSave }: { entry: Entry; busy: boolean; error: string; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  return <FormShell title="Editar lançamento" busy={busy} error={error} onClose={onClose}><form onSubmit={(event) => {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    onSave({ ...Object.fromEntries(fields), action: "edit", entryId: entry.id, amount: money(String(fields.get("amount"))) });
  }}><div className="fin-form-grid"><Field label="Descrição"><input name="description" defaultValue={entry.description} required maxLength={500} /></Field><Field label="Valor (R$)"><input name="amount" defaultValue={inputMoney(entry.amount)} inputMode="decimal" required /></Field><Field label="Competência"><input name="competence" type="month" defaultValue={entry.competence} required /></Field></div><Field label="Observações"><textarea name="notes" rows={3} defaultValue={entry.notes} /></Field><p className="fin-footnote">Altera apenas este lançamento. A mudança fica no histórico.</p><footer><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}>Salvar alteração</Button></footer></form></FormShell>;
}
