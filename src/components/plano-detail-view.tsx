"use client";

import { CalendarDays, Camera, CheckCircle2, ClipboardList, FileCheck2, MessageSquareText, Package, Palette, Plus, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PlanCalendar } from "@/components/plan-calendar";
import { PlanRescheduleButton } from "@/components/plan-reschedule";
import { TaskModal } from "@/components/task-modal";
import { ClientLinkPanel } from "@/components/client-link-panel";
import { useConfirm } from "@/components/confirm-dialog";
import { formatDueDate } from "@/lib/dates";
import { networkError, responseError } from "@/lib/request-error";
import { summarizeApprovalRound } from "@/lib/approval-workflow";
import { inheritsCaptureEditor } from "@/lib/assignee-inheritance";
import { TASK_STATUSES } from "@/lib/types";
import type { Member, Plan, PlanApprovalResponse, PlanCaptacao, PlanEvent, PlanItemApproval, Project, StatusColor, Tag, Task } from "@/lib/types";

const NO_MEMBER = "none";
const NO_FORMAT_KEY = "__sem_formato__";

function statusGroup(status: Task["status"]): string {
  return TASK_STATUSES.find((s) => s.value === status)?.group || "nao_iniciada";
}

function statusLabel(status: Task["status"]): string {
  return TASK_STATUSES.find((s) => s.value === status)?.label || status;
}

export function PlanoDetailView({
  plan,
  project,
  initialCaptacoes,
  initialTasks,
  initialApprovals,
  approvalResponses,
  captureSuggestions,
  members,
  formatTags,
  channelTags,
  categoryTags,
  statusColors,
  currentUserId,
  canEdit = true,
}: {
  plan: Plan;
  project: Project;
  initialCaptacoes: PlanCaptacao[];
  initialTasks: Task[];
  initialApprovals: PlanItemApproval[];
  approvalResponses: PlanApprovalResponse[];
  captureSuggestions: PlanEvent[];
  members: Member[];
  formatTags: Tag[];
  channelTags: Tag[];
  categoryTags: Tag[];
  statusColors: StatusColor[];
  currentUserId: string;
  canEdit?: boolean;
}) {
  const [captacoes, setCaptacoes] = useState(initialCaptacoes);
  const [suggestions, setSuggestions] = useState(captureSuggestions);
  const [tasks, setTasks] = useState(initialTasks);
  const [newCaptacaoLabel, setNewCaptacaoLabel] = useState("");
  const [newPackageKind, setNewPackageKind] = useState<PlanCaptacao["packageKind"]>("creation");
  const [newItemName, setNewItemName] = useState("");
  const [newItemFormatId, setNewItemFormatId] = useState(formatTags[0]?.id || "");
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  const [renamingCaptacaoId, setRenamingCaptacaoId] = useState("");
  const [captacaoLabelDraft, setCaptacaoLabelDraft] = useState("");
  const [editingField, setEditingField] = useState("");
  const [toast, setToast] = useState("");
  const [workflowError, setWorkflowError] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  const isContent = plan.kind === "content";
  const approvalByTask = useMemo(() => new Map(initialApprovals.map((approval) => [approval.taskId, approval])), [initialApprovals]);
  const responsesByTask = useMemo(() => {
    const map = new Map<string, PlanApprovalResponse[]>();
    approvalResponses.forEach((response) => map.set(response.taskId, [...(map.get(response.taskId) || []), response]));
    return map;
  }, [approvalResponses]);
  const approvalLabels = { pending: "Pendente", approved: "Aprovado", changes_requested: "Ajuste solicitado", rejected: "Reprovado" } as const;

  const copyApprovals = tasks.map((task) => {
    const approval = approvalByTask.get(task.id);
    if (!approval) return { taskId: task.id, status: "pending" as const, reviewVersion: 1, updatedAt: task.updatedAt };
    return approval.reviewVersion >= 100 ? { ...approval, status: "approved" as const, reviewVersion: 1 } : approval;
  });
  const hasCreativeRound = initialApprovals.some((approval) => approval.reviewVersion >= 100);
  const creativeApprovals = tasks.map((task) => {
    const approval = approvalByTask.get(task.id);
    return approval?.reviewVersion && approval.reviewVersion >= 100
      ? approval
      : { taskId: task.id, status: "pending" as const, reviewVersion: 100, updatedAt: task.updatedAt };
  });
  const activeStage = hasCreativeRound ? "creative" as const : "copy" as const;
  const activeSummary = summarizeApprovalRound(activeStage === "creative" ? creativeApprovals : copyApprovals, activeStage);
  const copySummary = summarizeApprovalRound(copyApprovals, "copy");
  const creativeSummary = hasCreativeRound ? summarizeApprovalRound(creativeApprovals, "creative") : null;
  const creativeBlockers = tasks.flatMap((task) => {
    const approval = approvalByTask.get(task.id);
    const blockers: string[] = [];
    if (!approval || (approval.reviewVersion < 100 && approval.status !== "approved")) blockers.push(`${task.name}: texto ainda não aprovado`);
    if (!task.driveLink?.trim()) blockers.push(`${task.name}: link do material não informado`);
    return blockers;
  });
  const approvedTextCount = tasks.filter((task) => {
    const approval = approvalByTask.get(task.id);
    return Boolean(approval && (approval.reviewVersion >= 100 || approval.status === "approved"));
  }).length;
  const linkedMaterialCount = tasks.filter((task) => task.driveLink?.trim()).length;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function addCaptacao(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newCaptacaoLabel.trim()) return;
    const response = await fetch("/api/plan-captacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, label: newCaptacaoLabel, packageKind: newPackageKind, sequenceOrder: captacoes.length }),
    });
    const result = await response.json();
    if (!response.ok) return showToast(result.error || "Não foi possível criar o pacote.");
    setCaptacoes((current) => [...current, result.captacao]);
    setNewCaptacaoLabel("");
  }

  async function removeCaptacao(captacao: PlanCaptacao) {
    const used = tasks.filter((t) => t.captacaoId === captacao.id).length;
    const message = used
      ? `Remover "${captacao.label}"? ${used} ${used === 1 ? "item fica" : "itens ficam"} sem pacote (nada é excluído).`
      : `Remover "${captacao.label}"?`;
    if (!(await confirm({ title: "Remover pacote", message, confirmLabel: "Remover", danger: true }))) return;
    const response = await fetch(`/api/plan-captacoes/${captacao.id}`, { method: "DELETE" });
    if (!response.ok) return showToast("Não foi possível remover a captação.");
    setCaptacoes((current) => current.filter((c) => c.id !== captacao.id));
    setTasks((current) => current.map((t) => (t.captacaoId === captacao.id ? { ...t, captacaoId: undefined } : t)));
  }

  async function setSuggestionDate(captacaoId: string, suggestedDate: string) {
    const response = await fetch(`/api/plan-captacoes/${captacaoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suggestedDate }) });
    const result = await response.json();
    if (!response.ok) return showToast(result.error || "Não foi possível salvar a sugestão.");
    setSuggestions((current) => [...current.filter((event) => !event.eventType.endsWith(`:${captacaoId}`)), ...(result.event ? [result.event] : [])]);
    const packageItem = captacoes.find((item) => item.id === captacaoId);
    showToast(suggestedDate ? (packageItem?.packageKind === "capture" ? "Sugestão de captação salva." : "Prazo de criação salvo.") : "Data removida.");
  }

  function startRenameCaptacao(captacao: PlanCaptacao) {
    if (!canEdit) return;
    setRenamingCaptacaoId(captacao.id);
    setCaptacaoLabelDraft(captacao.label);
  }

  async function commitRenameCaptacao(captacao: PlanCaptacao) {
    const label = captacaoLabelDraft.trim();
    setRenamingCaptacaoId("");
    if (!label || label === captacao.label) return;
    setCaptacoes((current) => current.map((item) => (item.id === captacao.id ? { ...item, label } : item)));
    const response = await fetch(`/api/plan-captacoes/${captacao.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.captacao) {
      setCaptacoes((current) => current.map((item) => (item.id === captacao.id ? captacao : item)));
      return showToast(result.error || "Não foi possível renomear o pacote.");
    }
    setCaptacoes((current) => current.map((item) => (item.id === captacao.id ? result.captacao : item)));
    // O título do evento de agenda é derivado do nome — refaz na lista local.
    setSuggestions((current) => current.map((event) => event.eventType.endsWith(`:${captacao.id}`)
      ? { ...event, title: `${event.eventType.startsWith("captacao:") ? "Sugestão de captação" : "Prazo de criação"}: ${label}` }
      : event));
    showToast("Pacote renomeado.");
  }

  async function setPackageKind(captacaoId: string, packageKind: PlanCaptacao["packageKind"]) {
    const response = await fetch(`/api/plan-captacoes/${captacaoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageKind }) });
    const result = await response.json();
    if (!response.ok || !result.captacao) return showToast(result.error || "Não foi possível alterar o tipo do pacote.");
    setCaptacoes((current) => current.map((item) => item.id === captacaoId ? result.captacao : item));
    if (packageKind === "creation") setSuggestions((current) => current.map((event) => event.eventType === `captacao:${captacaoId}` ? { ...event, eventType: `producao:${captacaoId}`, title: `Prazo de criação: ${result.captacao.label}` } : event));
    showToast(packageKind === "capture" ? "Pacote definido com captação." : "Pacote definido apenas para criação.");
  }

  async function setCaptureAssignee(captacaoId: string, field: "recordingAssigneeId" | "editingAssigneeId", memberId: string) {
    const value = memberId === NO_MEMBER ? null : memberId;
    const response = await fetch(`/api/plan-captacoes/${captacaoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    const raw = await response.text();
    let result: { error?: string; captacao?: PlanCaptacao } = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch { result = {}; }
    if (!response.ok || !result.captacao) return showToast(result.error || "Não foi possível atualizar o responsável.");
    const updatedCapture = result.captacao;
    setCaptacoes((current) => current.map((capture) => capture.id === captacaoId ? updatedCapture : capture));
    if (field === "editingAssigneeId") {
      setTasks((current) => current.map((task) => task.captacaoId === captacaoId && inheritsCaptureEditor(task.assigneeId, task.assigneeSource) ? { ...task, assigneeId: value || undefined, assigneeSource: "captacao" } : task));
      showToast("Editor atualizado e aplicado aos conteúdos herdados.");
    }
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newItemName.trim()) return;
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: plan.projectId,
        name: newItemName,
        planId: plan.id,
        formatTagIds: isContent && newItemFormatId ? [newItemFormatId] : undefined,
        sequenceOrder: isContent ? undefined : tasks.length,
      }),
    });
    const result = await response.json();
    if (!response.ok) return showToast(result.error || "Não foi possível criar o item.");
    setTasks((current) => [...current, result.task]);
    setNewItemName("");
  }

  async function openApprovalRound(stage: "copy" | "creative") {
    setWorkflowError("");
    const response = await fetch(`/api/plans/${plan.id}/approval-round`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    const result = await response.json();
    if (!response.ok) {
      const details = Array.isArray(result.blockers) && result.blockers.length ? ` ${result.blockers.slice(0, 3).join(" · ")}${result.blockers.length > 3 ? "…" : ""}` : "";
      const message = `${result.error || "Não foi possível abrir a aprovação."}${details}`;
      setWorkflowError(message);
      return showToast(message);
    }
    showToast(stage === "copy" ? `${result.opened} texto(s) enviado(s) para aprovação.` : `${result.opened} criativo(s) enviado(s) para aprovação.`);
    window.setTimeout(() => window.location.reload(), 650);
  }

  // Captação é atribuída por item (e é universal: vale pra vídeo, carrossel,
  // estático — qualquer formato pode precisar de uma sessão de captação).

  // Arrastar no calendário é a mesma edição do campo de prazo, feita com a
  // mão. A tela muda na hora e o PATCH vai atrás: soltar um card e esperar o
  // servidor pra ver o card mudar de lugar seria arrastar em câmera lenta.
  async function moveTaskDate(taskId: string, dueDate: string) {
    const anterior = tasks.find((t) => t.id === taskId)?.dueDate;
    setTasks((current) => current.map((t) => (t.id === taskId ? { ...t, dueDate } : t)));
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate }),
      });
      if (!response.ok) {
        setTasks((current) => current.map((t) => (t.id === taskId ? { ...t, dueDate: anterior } : t)));
        return setToast(await responseError(response, "mudar a data"));
      }
      const { task } = await response.json();
      setTasks((current) => current.map((t) => (t.id === taskId ? task : t)));
    } catch {
      setTasks((current) => current.map((t) => (t.id === taskId ? { ...t, dueDate: anterior } : t)));
      setToast(networkError("mudar a data"));
    }
  }

  function onTaskSaved(task: Task) {
    setTasks((current) => (current.some((t) => t.id === task.id) ? current.map((t) => (t.id === task.id ? task : t)) : [...current, task]));
  }

  function onTaskDeleted(id: string) {
    setTasks((current) => current.filter((t) => t.id !== id));
    setEditingTask(undefined);
  }

  const categoryTagById = useMemo(() => new Map(categoryTags.map((t) => [t.id, t])), [categoryTags]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const captacaoById = useMemo(() => new Map(captacoes.map((c) => [c.id, c])), [captacoes]);

  // Agrupamento principal = FORMATO (vídeo, carrossel, estático...). Captação
  // é uma marcação transversal escolhida por item, não o agrupador.
  const itemsByFormat = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const key = task.formatTagIds[0] || NO_FORMAT_KEY;
      map.set(key, [...(map.get(key) || []), task]);
    });
    return map;
  }, [tasks]);

  const processItems = useMemo(() => [...tasks].sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0)), [tasks]);

  const progressRate = activeSummary.reviewedRate;


  // Responsável do pacote: texto até alguém clicar. O seletor só é montado
  // enquanto está aberto, e some no blur.
  function renderMemberField(
    c: PlanCaptacao,
    field: "recordingAssigneeId" | "editingAssigneeId",
    aberto: boolean,
    abrir: () => void,
  ) {
    const atual = c[field];
    const nome = atual ? memberById.get(atual)?.name : "";
    if (!aberto) {
      return (
        <button type="button" className={`quiet-value${nome ? "" : " is-empty"}`} onClick={abrir} disabled={!canEdit}>
          {nome || "definir"}
        </button>
      );
    }
    return (
      <select
        autoFocus
        aria-label={`Responsável do pacote ${c.label}`}
        value={atual || NO_MEMBER}
        onChange={(event) => { setCaptureAssignee(c.id, field, event.target.value); setEditingField(""); }}
        onBlur={() => setEditingField("")}
      >
        <option value={NO_MEMBER}>Sem responsável</option>
        {members.filter((member) => member.active).map((member) => (
          <option key={member.id} value={member.id}>{member.name}</option>
        ))}
      </select>
    );
  }

  function renderTaskRow(task: Task) {
    const categories = task.categoryTagIds.map((id) => categoryTagById.get(id)?.label).filter(Boolean);
    const assignee = task.assigneeId ? memberById.get(task.assigneeId)?.name : undefined;
    const approval = approvalByTask.get(task.id);
    const clientResponses = responsesByTask.get(task.id) || [];
    const approvalStatus = approval?.status || "pending";
    return (
      <li key={task.id} className="plan-item-row">
        <div className="plan-item-row-main" onClick={() => setEditingTask(task)}>
          <strong>{task.name}</strong>
          <div className="plan-item-row-meta">
            {categories.map((label) => <span className="badge channel" key={label}>{label}</span>)}
            {assignee ? <span className="plan-item-assignee">{assignee}</span> : null}
            {task.dueDate ? <span className="plan-item-due"><CalendarDays size={11} /> {formatDueDate(task.dueDate)}</span> : null}
            {clientResponses[0]?.comment ? <span className="plan-client-comment" title={clientResponses[0].comment}><MessageSquareText size={11} /> {clientResponses[0].reviewerName}: {clientResponses[0].comment}</span> : null}
          </div>
        </div>
        {/* Lado direito só de LEITURA. O pacote era um dropdown em cada linha,
            e trocar pacote é edição de tarefa: agora acontece dentro do modal,
            junto de responsável, prazo e formato, na mesma gramática do resto
            do app. A lista voltou a ser uma lista. */}
        <div className="plan-item-row-side" onClick={() => setEditingTask(task)}>
          {isContent && task.captacaoId ? (
            <span className="plan-item-package" title={captacaoById.get(task.captacaoId)?.label}>
              <Package size={11} /> {captacaoById.get(task.captacaoId)?.label}
            </span>
          ) : null}
          <span className={`approval-status approval-${approvalStatus}`}>{approvalLabels[approvalStatus]}</span>
          <span className={`status ${statusGroup(task.status)}`}>{statusLabel(task.status)}</span>
        </div>
      </li>
    );
  }

  function renderFormatGroup(formatId: string, label: string) {
    const groupTasks = itemsByFormat.get(formatId) || [];
    if (!groupTasks.length) return null;
    return (
      <div key={formatId}>
        <div className="plan-group-label">{label} <em>{groupTasks.length}</em></div>
        <ul className="plan-item-list">{groupTasks.map(renderTaskRow)}</ul>
      </div>
    );
  }

  return (
    <>
      <main className="admin-page dashboard">
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">{project.name}</span>
            <h1>{plan.title}</h1>
            <p>{isContent ? "Conteúdos agrupados por formato. A captação é escolhida por item — qualquer formato pode entrar numa captação." : "Passos ordenados do processo."}</p>
          </div>
          {/* Uma leitura só do andamento, e não quatro. O detalhe por etapa
              está logo abaixo, no fluxo do cliente. */}
          <div className="plan-headline-stats">
            <span><strong>{tasks.length}</strong> itens</span>
            <span><strong>{activeSummary.approved}</strong> aprovados</span>
            <span><strong>{activeSummary.total - activeSummary.reviewed}</strong> aguardando o cliente</span>
          </div>
        </div>

        {tasks.length ? (
          <div className="plan-progress-track" style={{ marginBottom: 22 }}>
            <div className="plan-progress-fill" style={{ width: `${progressRate}%` }} />
          </div>
        ) : null}

        <ClientLinkPanel projectId={project.id} projectName={project.client || project.name} canEdit={canEdit} onToast={showToast} />

        {isContent ? <section className="plan-workflow-panel" aria-label="Fluxo de aprovação do plano">
          <div className="plan-workflow-head">
            <div><span className="eyebrow">Fluxo do cliente</span><h2>{activeStage === "copy" ? "Aprovação de texto" : "Aprovação de criativos"}</h2><p>Rodada {activeSummary.round} · {activeSummary.reviewed} de {activeSummary.total} conteúdos revisados · {activeSummary.approvalRate}% aprovados</p></div>
            <span className={`plan-review-state ${activeSummary.fullyReviewed ? "is-complete" : ""}`}>{activeSummary.reviewedRate}% revisado</span>
          </div>
          <div className="plan-workflow-steps">
            <div className={copySummary.fullyReviewed ? "is-complete" : "is-current"}><FileCheck2 size={18} /><span><strong>1. Textos</strong><small>{copySummary.reviewed}/{copySummary.total} revisados · {copySummary.approved} aprovados</small></span></div>
            <div className={creativeSummary?.fullyReviewed ? "is-complete" : hasCreativeRound ? "is-current" : "is-locked"}><Palette size={18} /><span><strong>2. Criativos</strong><small>{creativeSummary ? `${creativeSummary.reviewed}/${creativeSummary.total} revisados · ${creativeSummary.approved} aprovados` : "Aguardando textos, criação e links"}</small></span></div>
          </div>
          <div className="plan-creative-readiness">
            <strong>Requisitos para enviar os criativos</strong>
            <span className={approvedTextCount === tasks.length ? "is-ready" : ""}><CheckCircle2 size={13} /> Textos aprovados: {approvedTextCount}/{tasks.length}</span>
            <span className={linkedMaterialCount === tasks.length ? "is-ready" : ""}><CheckCircle2 size={13} /> Links adicionados: {linkedMaterialCount}/{tasks.length}</span>
            {creativeBlockers.length ? <ul>{creativeBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : <small>Plano pronto para ser enviado à aprovação de criativos.</small>}
          </div>
          {workflowError ? <div className="form-message" role="alert">{workflowError}</div> : null}
          {canEdit ? <div className="plan-workflow-actions">
            <button type="button" className="secondary-button" onClick={() => openApprovalRound("copy")}><Send size={14} /> Enviar textos pendentes</button>
            <button type="button" className="primary-button" disabled={creativeBlockers.length > 0} title={creativeBlockers.length ? "Resolva os requisitos indicados acima." : undefined} onClick={() => openApprovalRound("creative")}><Palette size={14} /> Enviar criativos para aprovação</button>
          </div> : null}
          <p className="plan-workflow-hint">Após a aprovação do texto, conteúdos com captação ficam em <strong>Aguardando captação</strong>; os demais seguem para <strong>Pronto para criação</strong>. Para enviar os criativos, todos os conteúdos do plano precisam ter texto aprovado e link do material.</p>
        </section> : null}

        {isContent ? (
          <section className="panel" style={{ marginBottom: 18 }}>
            <div className="panel-head">
              <div>
                <h2><ClipboardList size={15} style={{ verticalAlign: -2 }} /> Pacotes de produção</h2>
                <p>Agrupe as entregas e escolha se o pacote exige captação ou segue direto para criação.</p>
              </div>
            </div>
            {/* O card tinha, sempre à vista, dois botões de tipo, um campo de
                data e até dois seletores de responsável. Quatro controles
                abertos por pacote, num plano com cinco pacotes, são vinte
                caixas competindo com a informação. Agora cada valor é texto
                até alguém clicar nele, que é como o modal da tarefa já
                funciona. */}
            <div className="plan-captacao-row">
              {captacoes.map((c) => {
                const count = tasks.filter((t) => t.captacaoId === c.id).length;
                const captura = c.packageKind === "capture";
                const prazo = suggestions.find((event) => event.eventType.endsWith(`:${c.id}`))?.eventDate || "";
                const editando = (campo: string) => editingField === `${c.id}:${campo}`;
                const abrir = (campo: string) => canEdit && setEditingField(`${c.id}:${campo}`);

                return (
                  <div key={c.id} className="plan-captacao-card">
                    <div className="plan-captacao-card-head">
                      <span className={`plan-package-icon ${c.packageKind}`}>{captura ? <Camera size={13} /> : <Palette size={13} />}</span>
                      {renamingCaptacaoId === c.id ? (
                        <input
                          className="plan-captacao-label-input"
                          autoFocus
                          maxLength={140}
                          value={captacaoLabelDraft}
                          aria-label={`Nome do pacote ${c.label}`}
                          onChange={(event) => setCaptacaoLabelDraft(event.target.value)}
                          onBlur={() => commitRenameCaptacao(c)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
                            if (event.key === "Escape") { setRenamingCaptacaoId(""); }
                          }}
                        />
                      ) : (
                        <strong
                          className={canEdit ? "plan-captacao-label is-editable" : "plan-captacao-label"}
                          onClick={() => startRenameCaptacao(c)}
                          title={canEdit ? "Clique para renomear" : undefined}
                        >{c.label}</strong>
                      )}
                      <em>{count}</em>
                      {canEdit ? <button type="button" onClick={() => removeCaptacao(c)} aria-label={`Remover ${c.label}`}><Trash2 size={12} /></button> : null}
                    </div>

                    <dl className="plan-captacao-meta">
                      <div>
                        <dt>Tipo</dt>
                        <dd>
                          {canEdit ? (
                            <button type="button" className="quiet-value" onClick={() => setPackageKind(c.id, captura ? "creation" : "capture")}>
                              {captura ? "Exige captação" : "Criação"}
                            </button>
                          ) : <span className="quiet-value is-static">{captura ? "Exige captação" : "Criação"}</span>}
                        </dd>
                      </div>

                      <div>
                        <dt>{captura ? "Captação" : "Prazo"}</dt>
                        <dd>
                          {editando("prazo") ? (
                            <input
                              type="date"
                              autoFocus
                              aria-label={`Data sugerida para ${c.label}`}
                              value={prazo}
                              onChange={(event) => setSuggestionDate(c.id, event.target.value)}
                              onBlur={() => setEditingField("")}
                            />
                          ) : (
                            <button type="button" className={`quiet-value${prazo ? "" : " is-empty"}`} onClick={() => abrir("prazo")} disabled={!canEdit}>
                              {prazo ? formatDueDate(prazo) : "definir"}
                            </button>
                          )}
                        </dd>
                      </div>

                      {captura ? (
                        <div>
                          <dt>Gravação</dt>
                          <dd>{renderMemberField(c, "recordingAssigneeId", editando("gravacao"), () => abrir("gravacao"))}</dd>
                        </div>
                      ) : null}

                      <div>
                        <dt>{captura ? "Edição" : "Criação"}</dt>
                        <dd>{renderMemberField(c, "editingAssigneeId", editando("edicao"), () => abrir("edicao"))}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
              {!captacoes.length ? <span className="plan-item-empty">Nenhum pacote ainda.</span> : null}
              {canEdit ? (
                <form onSubmit={addCaptacao} className="plan-captacao-form">
                  <input value={newCaptacaoLabel} onChange={(e) => setNewCaptacaoLabel(e.target.value)} placeholder="Ex.: Carrosséis — Pacote 1" />
                  <select aria-label="Tipo do novo pacote" value={newPackageKind} onChange={(event) => setNewPackageKind(event.target.value as PlanCaptacao["packageKind"])}><option value="creation">Pacote de criação</option><option value="capture">Exige captação</option></select>
                  <button className="secondary-button" type="submit"><Plus size={13} /></button>
                </form>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="split-layout" style={!canEdit ? { gridTemplateColumns: "1fr" } : undefined}>
          {canEdit ? (
            <section className="panel">
              <div className="panel-head"><h2>Novo item</h2></div>
              <form className="modal-body" onSubmit={addItem} style={{ padding: "24px 25px 27px" }}>
                <div className="field">
                  <label htmlFor="item-name">Nome</label>
                  <input id="item-name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder={isContent ? "Ex.: Pulando de paraquedas com meu cachorro" : "Ex.: E-mail de acesso enviado"} required maxLength={140} />
                </div>
                {isContent ? (
                  <div className="field">
                    <label htmlFor="item-format">Formato</label>
                    <select id="item-format" value={newItemFormatId} onChange={(e) => setNewItemFormatId(e.target.value)}>
                      <option value="">Sem formato</option>
                      {formatTags.map((t) => <option value={t.id} key={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                ) : null}
                <button className="primary-button" type="submit" style={{ width: "100%" }}>Adicionar item</button>
                <p className="plan-form-hint">Clique no item pra escrever a descrição (direcionamento, roteiro, referência) e escolher a captação.</p>
              </form>
            </section>
          ) : null}

          {isContent ? (
            <PlanCalendar
              tasks={tasks}
              formatTags={formatTags}
              canEdit={canEdit}
              onMove={moveTaskDate}
              onOpen={setEditingTask}
            />
          ) : null}

          <section className="panel list-panel">
            <div className="panel-head">
              <h2>Itens ({tasks.length})</h2>
              {isContent && canEdit ? (
                <PlanRescheduleButton
                  planId={plan.id}
                  onApplied={(atualizadas) => {
                    setTasks(atualizadas);
                    setToast("Calendário reorganizado.");
                  }}
                />
              ) : null}
            </div>
            {isContent ? (
              <>
                {formatTags.map((t) => renderFormatGroup(t.id, t.label))}
                {renderFormatGroup(NO_FORMAT_KEY, "Sem formato")}
              </>
            ) : (
              <ul className="plan-item-list">{processItems.map(renderTaskRow)}</ul>
            )}
            {!tasks.length ? (
              <div className="empty-state">
                <ClipboardList size={35} />
                <h3>Nenhum item ainda</h3>
                <p>Use o formulário ao lado para adicionar o primeiro.</p>
              </div>
            ) : null}
          </section>
        </div>

      </main>

      {editingTask !== undefined ? (
        <TaskModal
          task={editingTask}
          projects={[project]}
          members={members}
          formatTags={formatTags}
          channelTags={channelTags}
          categoryTags={categoryTags}
          statusColors={statusColors}
          captacoes={captacoes}
          defaultProjectId={plan.projectId}
          canEdit={canEdit}
          currentUserId={currentUserId}
          onClose={() => setEditingTask(undefined)}
          onSaved={onTaskSaved}
          onDeleted={onTaskDeleted}
          onDuplicated={onTaskSaved}
          onTagCreated={() => {}}
        />
      ) : null}
      {ConfirmDialog}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
