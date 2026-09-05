"use client";

import { AlertCircle, CalendarClock, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Copy, ExternalLink, ImageIcon, Images, Link2, MessageCircleMore, Play, Sparkles, Video, X } from "lucide-react";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { renderMarkdownLite } from "@/components/markdown-lite";
import { Button, Count, IconButton, Tag } from "@/components/vz";
import { DatePicker } from "@/components/vz/date-picker";
import { burst } from "@/lib/confetti";
import { renderScriptView } from "@/components/script-table";
import { descriptionHeadingKey, parseDescription } from "@/lib/description-sections";
import "../app/c/client-dashboard.css";

export type DashboardItem = {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  captacaoLabel: string | null;
  formatLabel: string | null;
  channelLabel: string | null;
  categoryLabel: string | null;
  reference: string | null;
  description: string | null;
  materialLink: string | null;
  approvalStatus: "pending" | "approved" | "changes_requested" | "rejected";
  reviewVersion: number;
  updatedAt: string;
};

export type DashboardEvent = { id: string; title: string; date: string; eventType: string };

const STATUS_LABEL: Record<string, string> = { pending: "pendente", approved: "aprovado", changes_requested: "em ajuste", rejected: "reprovado" };
const REVIEWER_KEY = "vizantu-client-reviewer-name";

// O nome do revisor vive no localStorage, que é externo ao React. Lê-lo no
// initializer de useState faria o HTML do servidor (sempre vazio) divergir do
// primeiro render no navegador; useSyncExternalStore é a via que o React
// oferece pra isso. Ninguém escreve nessa chave por fora, então não há a que
// se inscrever — o subscribe é um no-op.
const subscribeToStoredName = () => () => {};
const readStoredName = () => window.localStorage.getItem(REVIEWER_KEY) || "";
const readStoredNameOnServer = () => "";
const isCreativeStage = (item: DashboardItem) => item.reviewVersion >= 100;
const copyStatus = (item: DashboardItem) => isCreativeStage(item) ? "approved" : item.approvalStatus;
const isReviewed = (item: DashboardItem) => item.approvalStatus !== "pending";

function ContentIcon({ format, size = 13 }: { format?: string | null; size?: number }) {
  const value = (format || "").toLowerCase();
  if (/vídeo|video|reel/.test(value)) return <Play size={size} fill="currentColor" />;
  if (/carrossel/.test(value)) return <Images size={size} />;
  return <ImageIcon size={size} />;
}

function referenceUrl(reference: string | null) {
  return reference?.match(/https?:\/\/[^\s<>]+/i)?.[0] || null;
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
  const cells: { date: Date }[] = [];
  for (let i = startOffset; i > 0; i--) cells.push({ date: new Date(year, month, 1 - i) });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });
  let next = 1;
  while (cells.length % 7 !== 0 || cells.length < 35) cells.push({ date: new Date(year, month + 1, next++) });
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
    const counts = new Map<string, number>();
    for (const item of initialItems) if (item.dueDate) { const key = item.dueDate.slice(0, 7); counts.set(key, (counts.get(key) || 0) + 1); }
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    return dominant ? new Date(`${dominant}-01T12:00:00`) : new Date();
  });
  // A identificação é pedida na ENTRADA, não na hora de decidir. Antes disso o
  // cliente com pressa ia direto nos botões, que ficavam desabilitados por
  // causa do nome vazio — sem erro, sem aviso, só não acontecia nada. Com o
  // nome resolvido logo no começo, os botões nunca chegam desabilitados.
  const storedName = useSyncExternalStore(subscribeToStoredName, readStoredName, readStoredNameOnServer);
  // Enquanto o cliente não digita nada, vale o nome guardado. Depois que ele
  // edita (inclusive apagando), vale o que está no campo.
  const [editedName, setEditedName] = useState<string | null>(null);
  const reviewerName = editedName ?? storedName;
  // "Já se identificou" é grudento de propósito: apagar o nome dentro do modal
  // mostra o aviso de campo obrigatório, não traz o portão de entrada de volta
  // por cima da tela.
  const [passedGate, setPassedGate] = useState(false);
  const identified = passedGate || Boolean(storedName.trim());

  function confirmIdentification(name: string) {
    const clean = name.trim();
    if (!clean) return;
    window.localStorage.setItem(REVIEWER_KEY, clean);
    setEditedName(clean);
    setPassedGate(true);
  }

  const orderedItems = useMemo(() => [...items].sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") || a.name.localeCompare(b.name, "pt-BR")), [items]);
  const reviewedCount = items.filter(isReviewed).length;
  const approvedInStageCount = items.filter((item) => item.approvalStatus === "approved").length;
  const reviewedRate = items.length ? Math.round((reviewedCount / items.length) * 100) : 0;
  const approvalRate = items.length ? Math.round((approvedInStageCount / items.length) * 100) : 0;
  const adjustmentCount = items.filter((i) => i.approvalStatus === "changes_requested" || i.approvalStatus === "rejected").length;
  const pendingCount = items.filter((i) => i.approvalStatus === "pending").length;
  const lastDeliveries = useMemo(
    () => [...items].filter((i) => isCreativeStage(i) && i.approvalStatus === "approved" && (i.status === "aprovado" || i.status === "finalizado")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
    [items],
  );

  const cellsByDay = useMemo(() => {
    const map = new Map<string, { label: string; kind: "content" | "event" | "capture" | "deadline"; itemId?: string; format?: string | null; approvalStatus?: string }[]>();
    for (const item of orderedItems) {
      if (!item.dueDate) continue;
      (map.get(item.dueDate) || map.set(item.dueDate, []).get(item.dueDate)!).push({ label: item.name, kind: "content", itemId: item.id, format: item.formatLabel, approvalStatus: item.approvalStatus });
    }
    for (const ev of events) {
      const kind = ev.eventType.startsWith("captacao:") || /captação/i.test(ev.title) ? "capture" : ev.eventType.startsWith("producao:") || /prazo de criação|entrega do pacote/i.test(ev.title) ? "deadline" : "event";
      const label = ev.title.replace(/^(Sugestão de captação|Prazo de criação):\s*/i, "");
      (map.get(ev.date) || map.set(ev.date, []).get(ev.date)!).push({ label, kind });
    }
    return map;
  }, [orderedItems, events]);


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
    const currentIndex = orderedItems.findIndex((entry) => entry.id === item.id);
    const nextItem = orderedItems.slice(currentIndex + 1).find((entry) => entry.approvalStatus === "pending") || orderedItems.slice(0, currentIndex).find((entry) => entry.approvalStatus === "pending");
    setTimeout(() => setActiveItemId(status === "approved" && nextItem ? nextItem.id : null), status === "approved" ? 650 : 150);
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
            <p>Seu plano está em ordem de publicação. Abra o próximo conteúdo, confira <strong>texto ou criativo</strong> e registre sua decisão.</p>
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
              <span className="cd-eyebrow">Fluxo de aprovação</span>
              <h2>Conteúdos em ordem de publicação</h2>
            </div>
            <small>Toque em um conteúdo para ler e responder.</small>
          </div>

          <div className="cd-approval-bar-wrap">
            <div className="cd-approval-bar-label">
              <strong>{reviewedRate}% revisado</strong>
              <span>{reviewedCount} de {items.length} analisados</span>
            </div>
            <div className="cd-approval-bar-track"><div className="cd-approval-bar-fill" style={{ width: `${reviewedRate}%` }} /></div>
            <div className="cd-stage-progress"><span>Aprovação: {approvalRate}%</span><span>{approvedInStageCount} aprovados · {reviewedCount - approvedInStageCount} com retorno</span></div>
            {reviewedRate === 100 && items.length ? <div className="cd-review-complete"><CheckCircle2 size={16} /><span><strong>Plano 100% revisado.</strong> A equipe já pode seguir com os aprovados e preparar os ajustes necessários.</span></div> : null}
          </div>

          <div className="cd-sequence">
            {orderedItems.map((item, index) => (
              <button type="button" className="cd-sequence-item" key={item.id} onClick={() => setActiveItemId(item.id)}>
                <span className="cd-item-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="cd-sequence-date">{item.dueDate ? new Date(`${item.dueDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Sem data"}</span>
                <span className="cd-group-item-main">
                  <span className="cd-group-item-name">{item.name}</span>
                  <span className="cd-item-tags">
                    <Tag tone="violet" icon={<ContentIcon format={item.formatLabel} size={10} />}>{item.formatLabel || "Formato não informado"}</Tag>
                    <Tag tone="blue">{item.channelLabel || "Canal não informado"}</Tag>
                    {item.categoryLabel ? <Tag>{item.categoryLabel}</Tag> : null}
                  </span>
                </span>
                <span className="cd-sequence-stage"><span className={`cd-pill status-${item.approvalStatus}`}>{isCreativeStage(item) ? "Criativo" : "Texto"}: {STATUS_LABEL[item.approvalStatus]}</span>{item.reference ? <small><Link2 size={10} /> referência</small> : null}</span>
              </button>
            ))}
            {!orderedItems.length ? <div className="cd-empty-state"><CheckCircle2 size={26} /><strong>Tudo certo por aqui</strong><span>Nenhum conteúdo aguardando revisão.</span></div> : null}
          </div>
        </section>

        <div className="cd-section-heading">
          <div>
            <span className="cd-eyebrow">Planejamento</span>
            <h2>Calendário de publicações e entregas</h2>
          </div>
          <CalendarDays size={20} />
        </div>
        <section className="vz-cal client-calendar">
          <div className="vz-cal__head"><div className="calendar-month-title"><strong className="vz-cal__month">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong><Count>{orderedItems.filter((item) => item.dueDate?.startsWith(monthKey(month))).length} publicações</Count>{events.filter((event) => event.date.startsWith(monthKey(month))).length ? <Count>{events.filter((event) => event.date.startsWith(monthKey(month))).length} marcos do plano</Count> : null}</div><div className="vz-cal__nav"><IconButton size="sm" aria-label="Mês anterior" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={14} /></IconButton><Button variant="ghost" size="sm" onClick={() => setMonth(new Date())}>Hoje</Button><IconButton size="sm" aria-label="Próximo mês" onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={14} /></IconButton></div></div>
          <div className="cd-calendar-key"><span><strong>Publicações</strong> são os conteúdos que irão ao ar.</span><span><strong>Marcos do plano</strong> são datas internas de captação, criação ou entrega do pacote.</span></div>
          <div className="calendar-scroll"><div className="vz-cal__weekdays">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span key={day}>{day}</span>)}</div><div className="vz-cal__grid">
            {grid.map((cell, idx) => {
              const iso = isoDate(cell.date);
              const dayItems = cellsByDay.get(iso) || [];
              const muted = monthKey(cell.date) !== currentMonthKey;
              return (
                <div className={`vz-cal__day${muted ? " vz-cal__day--out" : ""}`} key={idx}><span className="vz-cal__daynum">{cell.date.getDate()}</span>
                  {dayItems.slice(0, 3).map((d, i) => (
                    <button key={i} className={`vz-cal-card ${d.kind === "content" ? `vz-cal-card--${/carrossel/i.test(d.format || "") ? "blue" : /estát|imagem/i.test(d.format || "") ? "green" : "violet"}` : `cd-milestone-card cd-milestone-card--${d.kind}`}`} title={d.label} onClick={() => d.itemId && setActiveItemId(d.itemId)} disabled={!d.itemId}><div className="vz-cal-card__top">{d.kind === "content" ? <span className="vz-minitag vz-minitag--outline"><ContentIcon format={d.format} size={10} /> Publicação · {d.format || "formato não informado"}</span> : <span className="cd-milestone-label">{d.kind === "capture" ? <><Video size={11} /> Captação do pacote</> : d.kind === "deadline" ? <><CalendarClock size={11} /> Entrega do pacote</> : <><CalendarDays size={11} /> Marco do plano</>}</span>}</div><span className="vz-cal-card__title">{d.label}</span>{d.kind === "content" ? <span className={`vz-minitag vz-minitag--${d.approvalStatus === "approved" ? "green" : d.approvalStatus === "rejected" ? "red" : "blue"}`}>{STATUS_LABEL[d.approvalStatus || "pending"]}</span> : null}</button>
                  ))}
                </div>
              );
            })}
          </div></div><div className="vz-cal__legend cd-calendar-legend"><strong>Publicações:</strong><span><i className="vz-dot vz-dot--violet" />Reels</span><span><i className="vz-dot vz-dot--blue" />Carrossel</span><span><i className="vz-dot vz-dot--green" />Estático</span><strong className="cd-legend-divider">Marcos do plano:</strong><span className="cd-legend-milestone is-capture"><Video size={11} /> Captação</span><span className="cd-legend-milestone is-deadline"><CalendarClock size={11} /> Entrega do pacote</span></div>
        </section>
      </div>

      {activeItem ? (
        <ApprovalModal
          item={activeItem}
          scheduleItems={orderedItems}
          reviewerName={reviewerName}
          onReviewerNameChange={setEditedName}
          onClose={() => setActiveItemId(null)}
          onSubmit={submitReview}
        />
      ) : null}

      {!identified ? <IdentificationGate onConfirm={confirmIdentification} /> : null}

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
//
// Quando o roteiro é de vídeo, o corpo dele vira a tabela de cena, fala e
// lettering. É aqui que a tabela mais importa: o cliente aprova sem precisar
// decifrar qual linha é imagem, qual é fala e qual é o texto na tela. O botão
// de copiar continua copiando o TEXTO do roteiro, que é o que vai pro
// produtor.
export function ItemDescription({ text }: { text: string }) {
  const script = parseDescription(text).roteiro;
  const lines = text.split("\n");
  const headingIndex = lines.findIndex((line) => descriptionHeadingKey(line) === "roteiro");
  if (!script || headingIndex < 0) return <>{renderMarkdownLite(text)}</>;

  // Onde o roteiro acaba: no próximo cabeçalho de seção. Sem esse limite a
  // tabela engoliria a legenda e a referência que vêm depois dele.
  const nextHeading = lines.findIndex((line, index) => index > headingIndex && descriptionHeadingKey(line) !== null);
  const end = nextHeading < 0 ? lines.length : nextHeading;
  const table = renderScriptView(lines.slice(headingIndex + 1, end).join("\n"), "cd-script-table");

  const before = lines.slice(0, headingIndex).join("\n").replace(/\s+$/, "");
  // Sem tabela, o depois do cabeçalho continua sendo um pedaço só de texto —
  // exatamente como era antes de existir tabela nenhuma.
  const after = lines.slice(table ? end : headingIndex + 1).join("\n").replace(/^\n+/, "");
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
      {table}
      {after ? renderMarkdownLite(after) : null}
    </>
  );
}

// Primeira coisa que o cliente vê: sem nome, não dá pra seguir. Não tem botão
// de fechar nem fecha clicando fora de propósito — é justamente o passo que
// antes ficava escondido lá embaixo do modal de aprovação.
function IdentificationGate({ onConfirm }: { onConfirm: (name: string) => void }) {
  const [name, setName] = useState("");
  const ready = Boolean(name.trim());

  return (
    <div className="cd-overlay">
      <form
        className="cd-approval-modal cd-identify-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(name);
        }}
      >
        <h3>Antes de começar, quem é você?</h3>
        <div className="cd-meta">
          Toda aprovação, ajuste ou reprovação fica registrada com o seu nome, pra equipe saber com quem falar sobre cada retorno.
        </div>
        <label className="cd-reviewer-field">
          <span>Seu nome</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te identificar?" />
        </label>
        <button type="submit" className="cd-btn approve" disabled={!ready} style={{ marginTop: 14, width: "100%" }}>
          Continuar
        </button>
      </form>
    </div>
  );
}

function ApprovalModal({
  item,
  scheduleItems,
  reviewerName,
  onReviewerNameChange,
  onClose,
  onSubmit,
}: {
  item: DashboardItem;
  scheduleItems: DashboardItem[];
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
  const [dateError, setDateError] = useState("");
  const [dateSending, setDateSending] = useState(false);
  const approveRef = useRef<HTMLButtonElement>(null);
  const decisionClosed = isReviewed(item);
  const creativeStage = isCreativeStage(item);
  const dateConflicts = requestedDate ? scheduleItems.filter((entry) => entry.id !== item.id && entry.dueDate === requestedDate) : [];
  const requestedDateValue = requestedDate ? new Date(`${requestedDate}T12:00:00`) : null;
  const isWeekend = requestedDateValue ? requestedDateValue.getDay() === 0 || requestedDateValue.getDay() === 6 : false;

  async function requestDateChange() {
    if (!requestedDate || !reviewerName.trim()) return;
    setDateSending(true);
    setDateError("");
    const response = await fetch("/api/c/date-change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: item.id, reviewerName, requestedDate, reason: dateReason }) });
    const result = await response.json().catch(() => ({}));
    setDateSending(false);
    if (response.ok) { setDateSent(true); setDateRequestOpen(false); }
    else setDateError(result.error || "Não foi possível enviar a sugestão. Tente novamente.");
  }

  return (
    <div className="cd-overlay" onClick={onClose}>
      <div className="cd-approval-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cd-close" type="button" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        <h3>{item.name}</h3>
        <div className="cd-modal-context"><Tag tone="violet" icon={<ContentIcon format={item.formatLabel} size={10} />}>{item.formatLabel || "Formato não informado"}</Tag><Tag tone="blue">{item.channelLabel || "Canal não informado"}</Tag>{item.dueDate ? <Tag outline>{new Date(`${item.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}</Tag> : null}</div>

        <div className="cd-approval-steps">
          <span className={copyStatus(item) === "approved" ? "is-done" : "is-current"}>{copyStatus(item) === "approved" ? <Check size={13} /> : null} 1. Texto</span>
          <span className={creativeStage ? "is-current" : "is-locked"}>2. Criação</span>
        </div>

        {item.description ? <div className="cd-item-description"><ItemDescription text={item.description} /></div> : <div className="cd-item-description cd-description-empty">Este conteúdo ainda não tem descrição.</div>}

        {item.reference ? <div className="cd-reference-card"><span className="cd-eyebrow">Referência</span><p>{item.reference}</p>{referenceUrl(item.reference) ? <a href={referenceUrl(item.reference)!} target="_blank" rel="noreferrer"><ExternalLink size={13} />Abrir referência</a> : null}</div> : null}

        {creativeStage && item.materialLink ? <a className="cd-material-link" href={item.materialLink} target="_blank" rel="noreferrer"><ExternalLink size={16} /><span><strong>Abrir material para revisar</strong><small>Confira o {item.formatLabel || "material"} antes de responder.</small></span></a> : !creativeStage && item.approvalStatus === "approved" ? <div className="cd-material-wait"><Clock3 size={15} /> Texto aprovado. A criação aparecerá quando estiver pronta.</div> : null}

        {/* O nome já vem preenchido do portão de entrada. Isto aqui é pra
            corrigir/trocar — e pra avisar em voz alta se alguém apagar, em vez
            de só desabilitar os botões em silêncio. */}
        <label className="cd-reviewer-field">
          <span>Seu nome <em className="cd-field-required">obrigatório</em></span>
          <input
            value={reviewerName}
            onChange={(e) => onReviewerNameChange(e.target.value)}
            placeholder="Como podemos te identificar?"
            aria-invalid={!reviewerName.trim()}
          />
        </label>
        {!reviewerName.trim() ? (
          <p className="cd-reviewer-warning" role="alert">
            <AlertCircle size={14} /> Preencha seu nome para liberar os botões de resposta.
          </p>
        ) : null}

        <button type="button" className="cd-date-change-toggle" onClick={() => setDateRequestOpen((open) => !open)}><CalendarDays size={15} /> {dateSent ? "Pedido de nova data enviado" : "Pedir alteração de data"}</button>
        {dateRequestOpen ? <div className="cd-date-change-form">
          <label>Nova data sugerida<DatePicker value={requestedDate} onChange={setRequestedDate} placeholder="Escolher data" /></label>
          {requestedDate ? <div className={`cd-date-conflict ${dateConflicts.length ? "has-conflict" : "is-free"}`} role="status">
            {dateConflicts.length ? <><AlertCircle size={16} /><span><strong>{dateConflicts.length === 1 ? "Já existe 1 conteúdo nesse dia" : `Já existem ${dateConflicts.length} conteúdos nesse dia`}</strong>{dateConflicts.map((entry) => entry.name).join(" · ")}</span></> : <><CheckCircle2 size={16} /><span><strong>Dia livre no plano</strong>Nenhum outro conteúdo está marcado para esta data.</span></>}
          </div> : null}
          {isWeekend ? <div className="cd-date-weekend"><CalendarDays size={14} />A data escolhida cai no fim de semana.</div> : null}
          <label>Motivo (opcional)<textarea value={dateReason} onChange={(e) => setDateReason(e.target.value)} placeholder="Conte rapidamente por que essa data funciona melhor." /></label>
          {dateError ? <p className="cd-date-error" role="alert">{dateError}</p> : null}
          <button type="button" className="cd-btn date" disabled={!requestedDate || !reviewerName.trim() || dateSending} onClick={requestDateChange}>{dateSending ? "Enviando…" : "Enviar sugestão de data"}</button>
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
