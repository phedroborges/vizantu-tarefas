"use client";

import { ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clapperboard, Clock3, Copy, ExternalLink, ImageIcon, Images, MessageCircleMore, Play, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { renderMarkdownLite } from "@/components/markdown-lite";
import { burst } from "@/lib/confetti";
import { descriptionHeadingKey, parseDescription } from "@/lib/description-sections";
import "../app/c/client-dashboard.css";

export type DashboardItem = {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  captacaoLabel: string | null;
  formatLabel: string | null;
  categoryLabel: string | null;
  description: string | null;
  materialLink: string | null;
  approvalStatus: "pending" | "approved" | "changes_requested" | "rejected";
  reviewVersion: number;
  updatedAt: string;
};

export type DashboardEvent = { id: string; title: string; date: string; eventType: string };

const STATUS_LABEL: Record<string, string> = { pending: "pendente", approved: "aprovado", changes_requested: "em ajuste", rejected: "reprovado" };
const REVIEWER_KEY = "vizantu-client-reviewer-name";
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const isCreativeStage = (item: DashboardItem) => item.reviewVersion >= 100;
const copyStatus = (item: DashboardItem) => isCreativeStage(item) ? "approved" : item.approvalStatus;
const isReviewed = (item: DashboardItem) => item.approvalStatus !== "pending";
const roundNumber = (version: number) => version >= 100 ? version - 99 : version;

function ContentIcon({ format, size = 13 }: { format?: string | null; size?: number }) {
  const value = (format || "").toLowerCase();
  if (/vídeo|video|reel/.test(value)) return <Play size={size} fill="currentColor" />;
  if (/carrossel/.test(value)) return <Images size={size} />;
  return <ImageIcon size={size} />;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysGrid(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // segunda = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date | null }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({ date: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({ date: null });
  return cells;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}


export function ClientDashboard({
  clientName,
  roleTitle,
  city,
  instagramHandle,
  initialItems,
  events,
  initialScore,
}: {
  clientName: string;
  roleTitle: string | null;
  city: string | null;
  instagramHandle: string | null;
  initialItems: DashboardItem[];
  events: DashboardEvent[];
  initialScore: number | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [score, setScore] = useState(initialScore);
  const [surveyOpen, setSurveyOpen] = useState(false);
  // Guarda só o id, não o objeto — assim o modal sempre reflete o item mais
  // recente de `items` depois de um approve/ajuste/reprova, em vez de ficar
  // preso a um snapshot de antes da resposta chegar.
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const activeItem = items.find((i) => i.id === activeItemId) || null;
  const [month, setMonth] = useState(() => {
    const firstScheduled = [...initialItems]
      .filter((item) => item.dueDate)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0]?.dueDate;
    return firstScheduled ? new Date(`${firstScheduled}T12:00:00`) : new Date();
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem(REVIEWER_KEY) || "" : ""));

  const hasCreativeReview = items.some(isCreativeStage);
  const activeStage = hasCreativeReview ? "creative" : "copy";
  const activeStageItems = items.filter((item) => activeStage === "creative" ? isCreativeStage(item) : !isCreativeStage(item));
  const activeStageLabel = activeStage === "creative" ? "Aprovação de criativos" : "Aprovação de texto";
  const activeRound = Math.max(1, ...activeStageItems.map((item) => roundNumber(item.reviewVersion)));
  const reviewedCount = activeStageItems.filter(isReviewed).length;
  const approvedInStageCount = activeStageItems.filter((item) => item.approvalStatus === "approved").length;
  const reviewedRate = activeStageItems.length ? Math.round((reviewedCount / activeStageItems.length) * 100) : 0;
  const approvalRate = activeStageItems.length ? Math.round((approvedInStageCount / activeStageItems.length) * 100) : 0;
  const adjustmentCount = activeStageItems.filter((i) => i.approvalStatus === "changes_requested" || i.approvalStatus === "rejected").length;
  const pendingCount = activeStageItems.filter((i) => i.approvalStatus === "pending").length;
  const lastDeliveries = useMemo(
    () => [...items].filter((i) => isCreativeStage(i) && i.approvalStatus === "approved" && (i.status === "aprovado" || i.status === "finalizado")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
    [items],
  );

  const groups = useMemo(() => {
    const map = new Map<string, DashboardItem[]>();
    for (const item of items) {
      const label = item.captacaoLabel ? `${item.formatLabel || "Conteúdo"} | ${item.captacaoLabel}` : item.formatLabel || "Conteúdo";
      (map.get(label) || map.set(label, []).get(label)!).push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  const cellsByDay = useMemo(() => {
    const map = new Map<string, { label: string; kind: "content" | "event" | "capture"; itemId?: string; format?: string | null; approvalStatus?: string }[]>();
    for (const item of items) {
      if (!item.dueDate) continue;
      (map.get(item.dueDate) || map.set(item.dueDate, []).get(item.dueDate)!).push({ label: item.name, kind: "content", itemId: item.id, format: item.formatLabel, approvalStatus: item.approvalStatus });
    }
    for (const ev of events) {
      (map.get(ev.date) || map.set(ev.date, []).get(ev.date)!).push({ label: ev.title, kind: ev.eventType.startsWith("captacao:") ? "capture" : "event" });
    }
    return map;
  }, [items, events]);

  const selectedDayItems = selectedCalendarDate ? cellsByDay.get(selectedCalendarDate) || [] : [];

  function updateItemLocal(id: string, patch: Partial<DashboardItem>) {
    setItems((current) => current.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function submitReview(item: DashboardItem, status: "approved" | "changes_requested" | "rejected", comment: string, buttonEl?: HTMLElement) {
    const name = reviewerName.trim() || "Cliente";
    window.localStorage.setItem(REVIEWER_KEY, name);
    const response = await fetch("/api/c/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: item.id, reviewerName: name, status, comment }),
    });
    if (!response.ok) return;
    const result = await response.json();
    updateItemLocal(item.id, { approvalStatus: result.status, reviewVersion: result.reviewVersion, status: result.taskStatus });
    if (status === "approved" && buttonEl) {
      const rect = buttonEl.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 60);
    }
    setTimeout(() => setActiveItemId(null), status === "approved" ? 650 : 150);
  }

  async function submitSurvey(newScore: number) {
    await fetch("/api/c/satisfaction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: newScore }) });
    setScore(newScore);
    setSurveyOpen(false);
  }

  const grid = useMemo(() => daysGrid(month), [month]);
  const currentMonthKey = monthKey(month);

  return (
    <div className="cd-root">
      <div className="cd-shell">
        <header className="cd-header">
          <div>
            <span className="cd-eyebrow">Portal do cliente · Vizantu</span>
            <h1>Olá, {clientName}</h1>
            <p>Você está na etapa de <strong>{activeStageLabel.toLowerCase()}</strong>. Leia cada conteúdo e registre sua decisão.</p>
          </div>
          <div className="cd-header-meta">
            {[roleTitle, city].filter(Boolean).join(" · ")}
            {instagramHandle ? <div>@{instagramHandle.replace(/^@/, "")}</div> : null}
          </div>
        </header>

        <div className="cd-stats">
          <div className="cd-card cd-score-card">
            <h3>Nota da vizantu</h3>
            <div className="cd-score">{score !== null ? `${score}/10` : "—"}</div>
            <button type="button" className="cd-score-cta" onClick={() => setSurveyOpen(true)}>
              <Sparkles size={12} /> refazer a pesquisa de satisfação
            </button>
          </div>
          <div className="cd-card">
            <h3>Visão geral</h3>
            <div className="cd-status-overview">
              <span><CheckCircle2 size={16} /> <strong>{reviewedCount}</strong> revisados</span>
              <span><Clock3 size={16} /> <strong>{pendingCount}</strong> pendentes</span>
              <span><MessageCircleMore size={16} /> <strong>{adjustmentCount}</strong> ajustes/reprovações</span>
            </div>
          </div>
          <div className="cd-card">
            <h3>Últimas entregas</h3>
            <div className="cd-deliveries">
              {lastDeliveries.length ? (
                lastDeliveries.map((item) => (
                  <div className="cd-delivery-row" key={item.id}>
                    <span>{item.name}</span>
                    <span className="cd-pill tag">{item.formatLabel || "conteúdo"}</span>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: 12, color: "#999" }}>Ainda sem entregas.</span>
              )}
            </div>
          </div>
        </div>

        <section className="cd-review-section">
          <div className="cd-review-heading">
            <div>
              <span className="cd-eyebrow">Etapa atual · Rodada {activeRound}</span>
              <h2>{activeStageLabel}</h2>
            </div>
            <small>Toque em um conteúdo para ler e responder.</small>
          </div>

          <div className="cd-approval-bar-wrap">
            <div className="cd-approval-bar-label">
              <strong>{reviewedRate}% revisado</strong>
              <span>{reviewedCount} de {activeStageItems.length} analisados</span>
            </div>
            <div className="cd-approval-bar-track"><div className="cd-approval-bar-fill" style={{ width: `${reviewedRate}%` }} /></div>
            <div className="cd-stage-progress"><span>Aprovação: {approvalRate}%</span><span>{approvedInStageCount} aprovados · {reviewedCount - approvedInStageCount} com retorno</span></div>
            {reviewedRate === 100 && activeStageItems.length ? <div className="cd-review-complete"><CheckCircle2 size={16} /><span><strong>Rodada 100% revisada.</strong> A equipe já pode seguir com os aprovados e preparar os ajustes necessários.</span></div> : null}
          </div>

          <div className="cd-groups">
            {groups.map(([label, groupItems]) => (
              <div className="cd-group" key={label}>
                <div className="cd-group-head"><h3>{label}</h3><span>{groupItems.length} {groupItems.length === 1 ? "conteúdo" : "conteúdos"}</span></div>
                {groupItems.map((item, index) => (
                  <button type="button" className="cd-group-item" key={item.id} onClick={() => setActiveItemId(item.id)}>
                    <span className="cd-item-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="cd-group-item-main">
                      <span className="cd-group-item-name">{item.name}</span>
                      <span className="cd-item-tags">
                        {item.categoryLabel ? <span className="cd-pill tag">{item.categoryLabel}</span> : null}
                        <span className={`cd-pill status-${copyStatus(item)}`}>Texto: {STATUS_LABEL[copyStatus(item)]}</span>
                        <span className={`cd-pill ${isCreativeStage(item) ? `status-${item.approvalStatus}` : "stage-locked"}`}>Criação: {isCreativeStage(item) ? STATUS_LABEL[item.approvalStatus] : "aguardando"}</span>
                      </span>
                    </span>
                    <ArrowRight size={17} className="cd-item-arrow" />
                  </button>
                ))}
              </div>
            ))}
            {!groups.length ? <div className="cd-empty-state"><CheckCircle2 size={26} /><strong>Tudo certo por aqui</strong><span>Nenhum conteúdo aguardando revisão.</span></div> : null}
          </div>
        </section>

        <div className="cd-section-heading">
          <div>
            <span className="cd-eyebrow">Planejamento</span>
            <h2>Calendário de conteúdos</h2>
          </div>
          <CalendarDays size={20} />
        </div>
        <div className="cd-calendar">
          <div className="cd-calendar-head">
            <button type="button" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
            <strong style={{ fontSize: 13, textTransform: "capitalize" }}>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>
            <button type="button" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Próximo mês"><ChevronRight size={16} /></button>
          </div>
          <div className="cd-calendar-grid">
            {WEEKDAYS.map((w) => <div className="cd-calendar-weekday" key={w}>{w}</div>)}
            {grid.map((cell, idx) => {
              const iso = cell.date ? isoDate(cell.date) : null;
              const dayItems = iso ? cellsByDay.get(iso) || [] : [];
              const muted = !cell.date || monthKey(cell.date) !== currentMonthKey;
              return (
                <div className={`cd-calendar-cell ${muted ? "is-muted" : ""}`} key={idx}>
                  {cell.date ? <span className="cd-calendar-daynum">{cell.date.getDate()}</span> : null}
                  {dayItems.slice(0, 3).map((d, i) => (
                    <button type="button" key={i} className={`cd-cal-item status-${d.kind === "event" || d.kind === "capture" ? d.kind : d.approvalStatus}`} title={d.label} onClick={() => d.itemId && setActiveItemId(d.itemId)} disabled={!d.itemId}>
                      {d.kind === "capture" ? <Clapperboard size={11} /> : d.kind === "content" ? <ContentIcon format={d.format} size={10} /> : <CalendarDays size={10} />}
                      <span>{d.label}</span>
                      {d.approvalStatus === "approved" ? <Check size={10} /> : d.approvalStatus === "rejected" ? <X size={10} /> : null}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div className="cd-mobile-calendar">
          <div className="cd-mobile-calendar-head">
            <button type="button" onClick={() => { setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setSelectedCalendarDate(null); }} aria-label="Mês anterior"><ChevronLeft size={17} /></button>
            <strong>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>
            <button type="button" onClick={() => { setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setSelectedCalendarDate(null); }} aria-label="Próximo mês"><ChevronRight size={17} /></button>
          </div>
          <div className="cd-mobile-calendar-grid">
            {WEEKDAYS.map((weekday) => <span className="cd-mobile-weekday" key={weekday}>{weekday.slice(0, 1)}</span>)}
            {grid.map((cell, index) => {
              const date = cell.date ? isoDate(cell.date) : null;
              const entries = date ? cellsByDay.get(date) || [] : [];
              const selected = date === selectedCalendarDate;
              return <button type="button" key={index} className={`${!cell.date ? "is-empty" : ""}${selected ? " is-selected" : ""}`} disabled={!cell.date} onClick={() => date && setSelectedCalendarDate(date)}>
                {cell.date ? <span className="cd-mobile-day-number">{cell.date.getDate()}</span> : null}
                <span className="cd-mobile-day-icons">
                  {entries.slice(0, 4).map((entry, entryIndex) => <span key={entryIndex} className={`cd-mobile-format-icon status-${entry.kind === "capture" || entry.kind === "event" ? entry.kind : entry.approvalStatus}`}>
                    {entry.kind === "capture" ? <Clapperboard size={10} /> : entry.kind === "event" ? <CalendarDays size={10} /> : <ContentIcon format={entry.format} size={9} />}
                  </span>)}
                  {entries.length > 4 ? <small>+{entries.length - 4}</small> : null}
                </span>
              </button>;
            })}
          </div>
          {selectedCalendarDate ? <div className="cd-mobile-day-detail">
            <div className="cd-mobile-day-detail-head">
              <strong>{new Date(`${selectedCalendarDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</strong>
              <button type="button" onClick={() => setSelectedCalendarDate(null)} aria-label="Fechar lista"><X size={15} /></button>
            </div>
            {selectedDayItems.length ? selectedDayItems.map((entry, index) => <button type="button" className="cd-mobile-day-item" key={index} disabled={!entry.itemId} onClick={() => entry.itemId && setActiveItemId(entry.itemId)}>
              <span className={`cd-mobile-format-icon status-${entry.kind === "capture" || entry.kind === "event" ? entry.kind : entry.approvalStatus}`}>{entry.kind === "capture" ? <Clapperboard size={12} /> : entry.kind === "event" ? <CalendarDays size={12} /> : <ContentIcon format={entry.format} size={11} />}</span>
              <span>{entry.label}</span>
              {entry.approvalStatus === "approved" ? <Check size={14} /> : entry.approvalStatus === "rejected" ? <X size={14} /> : entry.itemId ? <ArrowRight size={14} /> : null}
            </button>) : <p>Nenhum conteúdo neste dia.</p>}
          </div> : <p className="cd-mobile-calendar-hint">Toque em um dia para ver os conteúdos.</p>}
        </div>
      </div>

      {activeItem ? (
        <ApprovalModal
          item={activeItem}
          reviewerName={reviewerName}
          onReviewerNameChange={setReviewerName}
          onClose={() => setActiveItemId(null)}
          onSubmit={submitReview}
        />
      ) : null}

      {surveyOpen ? (
        <div className="cd-overlay" onClick={() => setSurveyOpen(false)}>
          <div className="cd-approval-modal" onClick={(e) => e.stopPropagation()}>
            <button className="cd-close" type="button" onClick={() => setSurveyOpen(false)} aria-label="Fechar"><X size={16} /></button>
            <h3>Como você avalia a Vizantu?</h3>
            <div className="cd-meta">Escolha uma nota de 0 a 10.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                <button key={n} type="button" className="cd-btn ghost" onClick={() => submitSurvey(n)}>{n}</button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// O roteiro é o que o cliente mais leva pra fora do portal (manda pro
// produtor, cola no roteirista). Copiar selecionando na tela sempre traz junto
// o cabeçalho e as seções vizinhas, então aqui o botão copia exatamente o
// texto da seção Roteiro — nada mais.
function CopyScriptButton({ script }: { script: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      // Sem clipboard API (contexto não seguro, navegador antigo do cliente)
      // ainda dá pra copiar pelo caminho velho, com um campo fora da tela.
      const field = document.createElement("textarea");
      field.value = script;
      field.setAttribute("readonly", "");
      field.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(field);
      if (!ok) return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" className={copied ? "cd-copy-script is-copied" : "cd-copy-script"} onClick={copy} title="Copiar o roteiro">
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "copiado" : "copiar"}
    </button>
  );
}

// Mesma descrição de sempre, só que com o cabeçalho do roteiro virando uma
// linha com o botão ao lado. Sem seção de roteiro (ou sem texto nela), cai no
// render normal — nenhum botão órfão aparece.
export function ItemDescription({ text }: { text: string }) {
  const script = parseDescription(text).roteiro;
  const lines = text.split("\n");
  const headingIndex = lines.findIndex((line) => descriptionHeadingKey(line) === "roteiro");
  if (!script || headingIndex < 0) return <>{renderMarkdownLite(text)}</>;

  const before = lines.slice(0, headingIndex).join("\n").replace(/\s+$/, "");
  const after = lines.slice(headingIndex + 1).join("\n").replace(/^\n+/, "");
  // O cabeçalho vira um bloco próprio (o CSS cuida do respiro em volta): as
  // quebras de linha aqui seriam nós de texto soltos no container, que não
  // tem pre-wrap, e colapsariam num espaço — o "Roteiro" grudaria na linha
  // anterior.
  return (
    <>
      {before ? renderMarkdownLite(before) : null}
      <span className="cd-script-heading">
        <strong>Roteiro</strong>
        <CopyScriptButton script={script} />
      </span>
      {after ? renderMarkdownLite(after) : null}
    </>
  );
}

function ApprovalModal({
  item,
  reviewerName,
  onReviewerNameChange,
  onClose,
  onSubmit,
}: {
  item: DashboardItem;
  reviewerName: string;
  onReviewerNameChange: (v: string) => void;
  onClose: () => void;
  onSubmit: (item: DashboardItem, status: "approved" | "changes_requested" | "rejected", comment: string, buttonEl?: HTMLElement) => void;
}) {
  const [comment, setComment] = useState("");
  const [pendingAction, setPendingAction] = useState<"changes_requested" | "rejected" | null>(null);
  const [dateRequestOpen, setDateRequestOpen] = useState(false);
  const [requestedDate, setRequestedDate] = useState("");
  const [dateReason, setDateReason] = useState("");
  const [dateSent, setDateSent] = useState(false);
  const approveRef = useRef<HTMLButtonElement>(null);
  const decisionClosed = isReviewed(item);
  const creativeStage = isCreativeStage(item);

  async function requestDateChange() {
    if (!requestedDate || !reviewerName.trim()) return;
    const response = await fetch("/api/c/date-change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: item.id, reviewerName, requestedDate, reason: dateReason }) });
    if (response.ok) { setDateSent(true); setDateRequestOpen(false); }
  }

  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="cd-approval-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cd-close" type="button" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        <h3>{item.name}</h3>
        <div className="cd-meta">{[item.formatLabel, item.captacaoLabel].filter(Boolean).join(" · ") || "Conteúdo"}</div>

        <div className="cd-approval-steps">
          <span className={copyStatus(item) === "approved" ? "is-done" : "is-current"}>{copyStatus(item) === "approved" ? <Check size={13} /> : null} 1. Texto</span>
          <span className={creativeStage ? "is-current" : "is-locked"}>2. Criação</span>
        </div>

        {item.description ? <div className="cd-item-description"><ItemDescription text={item.description} /></div> : <div className="cd-item-description cd-description-empty">Este conteúdo ainda não tem descrição.</div>}

        {creativeStage && item.materialLink ? <a className="cd-material-link" href={item.materialLink} target="_blank" rel="noreferrer"><ExternalLink size={16} /><span><strong>Abrir material para revisar</strong><small>Confira o {item.formatLabel || "material"} antes de responder.</small></span></a> : !creativeStage && item.approvalStatus === "approved" ? <div className="cd-material-wait"><Clock3 size={15} /> Texto aprovado. A criação aparecerá quando estiver pronta.</div> : null}

        <label className="cd-reviewer-field">
          <span>Seu nome</span>
          <input value={reviewerName} onChange={(e) => onReviewerNameChange(e.target.value)} placeholder="Como podemos te identificar?" />
        </label>

        <button type="button" className="cd-date-change-toggle" onClick={() => setDateRequestOpen((open) => !open)}><CalendarDays size={15} /> {dateSent ? "Pedido de nova data enviado" : "Pedir alteração de data"}</button>
        {dateRequestOpen ? <div className="cd-date-change-form">
          <label>Nova data sugerida<input type="date" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} /></label>
          <label>Motivo (opcional)<textarea value={dateReason} onChange={(e) => setDateReason(e.target.value)} placeholder="Conte rapidamente por que essa data funciona melhor." /></label>
          <button type="button" className="cd-btn date" disabled={!requestedDate || !reviewerName.trim()} onClick={requestDateChange}>Enviar sugestão de data</button>
        </div> : null}

        {decisionClosed ? (
          <div className={`cd-decision-closed status-${item.approvalStatus}`}>
            {item.approvalStatus === "approved" ? <Check size={18} className="cd-celebrate-icon" /> : <X size={18} />}
            <span><strong>{item.approvalStatus === "approved" ? "Aprovado" : item.approvalStatus === "changes_requested" ? "Ajuste solicitado" : "Reprovado"}</strong>Sua decisão nesta rodada foi registrada. Uma nova resposta só será liberada quando a equipe abrir outra versão.</span>
          </div>
        ) : (
          <>
            {pendingAction ? (
              <textarea
                autoFocus
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={pendingAction === "rejected" ? "Conta pra gente o motivo da reprovação" : "O que precisa ajustar?"}
              />
            ) : null}

            <div className="cd-approval-actions">
              <button
                ref={approveRef}
                type="button"
                className="cd-btn approve"
                disabled={!reviewerName.trim()}
                onClick={() => onSubmit(item, "approved", "", approveRef.current || undefined)}
              >
                {creativeStage ? "Aprovar criação" : "Aprovar texto"}
              </button>
              {pendingAction === "changes_requested" ? (
                <button type="button" className="cd-btn request" disabled={!comment.trim() || !reviewerName.trim()} onClick={() => onSubmit(item, "changes_requested", comment)}>
                  Enviar ajuste de {creativeStage ? "criação" : "texto"}
                </button>
              ) : (
                <button type="button" className="cd-btn request" onClick={() => setPendingAction("changes_requested")}>Pedir ajuste</button>
              )}
              {pendingAction === "rejected" ? (
                <button type="button" className="cd-btn reject" disabled={!comment.trim() || !reviewerName.trim()} onClick={() => onSubmit(item, "rejected", comment)}>
                  Confirmar reprovação
                </button>
              ) : (
                <button type="button" className="cd-btn reject" onClick={() => setPendingAction("rejected")}>Reprovar</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
