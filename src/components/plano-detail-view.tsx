"use client";

import { CalendarDays, Camera, ClipboardList, Link as LinkIcon, MessageSquareText, Package, Palette, Plus, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PlanCalendar } from "@/components/plan-calendar";
import { PlanRescheduleButton } from "@/components/plan-reschedule";
import { TaskModal } from "@/components/task-modal";
import { StatusTag, statusColorMap } from "@/components/status-tag";
import { ClientLinkPanel } from "@/components/client-link-panel";
import { useConfirm } from "@/components/confirm-dialog";
import { formatDueDate } from "@/lib/dates";
import { networkError, responseError } from "@/lib/request-error";
import { summarizeApprovalRound } from "@/lib/approval-workflow";
import { inheritsCaptureEditor } from "@/lib/assignee-inheritance";
import type { Member, Plan, PlanApprovalResponse, PlanCaptacao, PlanEvent, PlanItemApproval, Project, StatusColor, Tag, Task } from "@/lib/types";

const NO_MEMBER = "none";
const NO_FORMAT_KEY = "__sem_formato__";


// ---------- A visão de aprovação ----------
// É a MESMA lista de conteúdos, arrumada pela resposta do cliente em vez da
// etapa interna. As outras abas respondem "como está o nosso trabalho"; esta
// responde "o que o cliente já respondeu e o que está parado esperando ele" —
// que antes só dava pra saber abrindo o link do cliente e conferindo item por
// item.
const GRUPOS_APROVACAO = [
  { chave: "changes_requested", titulo: "Pediu ajuste", ajuda: "O cliente respondeu e quer mudança. É a fila que trava a rodada." },
  { chave: "rejected", titulo: "Reprovado", ajuda: "Precisa ser refeito." },
  { chave: "pending", titulo: "Aguardando o cliente", ajuda: "Enviado, sem resposta ainda." },
  { chave: "approved", titulo: "Aprovado pelo cliente", ajuda: "Liberado para seguir na esteira." },
] as const;

function PlanApprovalBoard({
  tasks,
  approvalByTask,
  responsesByTask,
  memberById,
  onOpenTask,
}: {
  tasks: Task[];
  approvalByTask: Map<string, PlanItemApproval>;
  responsesByTask: Map<string, PlanApprovalResponse[]>;
  memberById: Map<string, Member>;
  onOpenTask: (task: Task) => void;
}) {
  const porResposta = new Map<string, Task[]>();
  for (const task of tasks) {
    const status = approvalByTask.get(task.id)?.status || "pending";
    porResposta.set(status, [...(porResposta.get(status) || []), task]);
  }
  const temAlgo = GRUPOS_APROVACAO.some((grupo) => (porResposta.get(grupo.chave) || []).length);
  if (!temAlgo) {
    return (
      <div className="empty-state">
        <ClipboardList size={35} />
        <h3>Nada enviado ao cliente ainda</h3>
        <p>Assim que a primeira rodada for enviada, a resposta de cada conteúdo aparece aqui.</p>
      </div>
    );
  }

  return (
    <div className="plan-approval">
      {GRUPOS_APROVACAO.map((grupo) => {
        const doGrupo = porResposta.get(grupo.chave) || [];
        if (!doGrupo.length) return null;
        return (
          <div className="plan-approval__group" key={grupo.chave}>
            <div className="plan-approval__head">
              <span className={`approval-status approval-${grupo.chave}`}>{grupo.titulo}</span>
              <em>{doGrupo.length}</em>
              <small>{grupo.ajuda}</small>
            </div>
            {doGrupo.map((task) => {
              const resposta = (responsesByTask.get(task.id) || [])[0];
              const dono = task.assigneeId ? memberById.get(task.assigneeId)?.name : undefined;
              return (
                <article className="plan-approval__card" key={task.id}>
                  <div className="plan-approval__card-top" onClick={() => onOpenTask(task)}>
                    <strong>{task.name}</strong>
                    {dono ? <span className="plan-item-assignee">{dono}</span> : null}
                    {task.dueDate ? <span className="plan-item-due"><CalendarDays size={11} /> {formatDueDate(task.dueDate)}</span> : null}
                  </div>
                  {/* O recado do cliente vem como balão de conversa, e não como
                      texto solto: quem lê reconhece na hora que aquilo foi
                      alguém que escreveu. */}
                  {resposta?.comment ? (
                    <div className="plan-approval__quote">
                      <strong>{resposta.reviewerName}</strong>
                      <p>{resposta.comment}</p>
                    </div>
                  ) : null}
                  <div className="plan-approval__card-actions">
                    <button type="button" className="secondary-button" onClick={() => onOpenTask(task)}>
                      {grupo.chave === "approved" ? "Abrir conteúdo" : "Abrir e ajustar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        );
      })}
    </div>
  );
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
  // A tela deixou de empilhar cinco blocos numa coluna de 2.700px: conteúdo,
  // calendário e aprovação são VISÕES da mesma lista, então viram abas — do
  // mesmo jeito que a tela de tarefas já alterna lista e calendário.
  const [aba, setAba] = useState<"conteudos" | "calendario" | "aprovacao">("conteudos");
  // O link do cliente era um painel permanente de ~150px pra um endereço que
  // se copia uma vez por mês. Virou um botão que abre o painel quando precisa.
  const [linkAberto, setLinkAberto] = useState(false);
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
  const coresPorEtapa = useMemo(() => statusColorMap(statusColors), [statusColors]);

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
          <StatusTag status={task.status} colorByStatus={coresPorEtapa} />
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

  // ---------- A visão de aprovação ----------
  // É a MESMA lista de conteúdos, arrumada pela resposta do cliente em vez da
  // etapa interna. As outras abas respondem "como está o nosso trabalho"; esta
  // responde "o que o cliente já respondeu e o que está parado esperando ele"
  // — que antes só dava pra saber abrindo o link do cliente e conferindo item
  // por item.
  const aguardandoCliente = activeSummary.total - activeSummary.reviewed;
  const abas = [
    { value: "conteudos" as const, label: "Conteúdos", count: tasks.length },
    ...(isContent ? [{ value: "calendario" as const, label: "Calendário", count: undefined }] : []),
    { value: "aprovacao" as const, label: "Aprovação", count: aguardandoCliente || undefined },
  ];

  return (
    <>
      <main className="admin-page dashboard plan-screen">
        {/* Cabeçalho: o estado do plano cabe na primeira tela, sem rolar. */}
        <div className="plan-head">
          <div className="plan-head__text">
            <span className="eyebrow">{project.name}</span>
            <h1>{plan.title}</h1>
            <div className="plan-head__tags">
              <span className="badge format">{tasks.length} {tasks.length === 1 ? "item" : "itens"}</span>
              <span className="badge">{activeSummary.approved} aprovados</span>
              {aguardandoCliente > 0 ? <span className="badge list">{aguardandoCliente} aguardando o cliente</span> : null}
              {creativeBlockers.length ? <span className="badge is-danger">{creativeBlockers.length} pendências</span> : null}
            </div>
          </div>
          <div className="plan-head__actions">
            <button type="button" className="secondary-button" onClick={() => setLinkAberto((atual) => !atual)} aria-expanded={linkAberto}>
              <LinkIcon size={14} /> Link do cliente
            </button>
            {isContent && canEdit ? (
              <PlanRescheduleButton
                planId={plan.id}
                onApplied={(atualizadas) => { setTasks(atualizadas); setToast("Calendário reorganizado."); }}
              />
            ) : null}
          </div>
        </div>

        {tasks.length ? (
          <div className="plan-progress-track"><div className="plan-progress-fill" style={{ width: `${progressRate}%` }} /></div>
        ) : null}

        {linkAberto ? (
          <ClientLinkPanel projectId={project.id} projectName={project.client || project.name} canEdit={canEdit} onToast={showToast} />
        ) : null}

        {/* Fluxo do cliente: era um painel roxo de ~200px com duas caixas de
            etapa, uma lista de requisitos e um parágrafo de ajuda. Virou uma
            faixa: em que rodada está, quanto falta, e o que fazer. */}
        {isContent ? (
          <section className="plan-flow" aria-label="Fluxo de aprovação do plano">
            <div className="plan-flow__top">
              <span className="eyebrow">Fluxo do cliente · rodada {activeSummary.round}</span>
              <span className="badge format">{activeStage === "copy" ? "Aprovação de texto" : "Aprovação de criativos"}</span>
              <span className="plan-flow__count">{activeSummary.reviewed} de {activeSummary.total} revisados</span>
            </div>
            <div className="plan-progress-track plan-progress-track--thin">
              <div className="plan-progress-fill" style={{ width: `${activeSummary.reviewedRate}%` }} />
            </div>
            {workflowError ? <div className="form-message" role="alert">{workflowError}</div> : null}
            {canEdit ? (
              <div className="plan-flow__actions">
                <button type="button" className="success-button" onClick={() => openApprovalRound("copy")}><Send size={14} /> Enviar textos pendentes</button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={creativeBlockers.length > 0}
                  title={creativeBlockers.length ? "Resolva os requisitos indicados." : undefined}
                  onClick={() => openApprovalRound("creative")}
                ><Palette size={14} /> Enviar criativos</button>
                <span className="plan-flow__hint">
                  Textos aprovados {approvedTextCount}/{tasks.length} · links {linkedMaterialCount}/{tasks.length}
                  {creativeBlockers.length ? ` · faltam ${creativeBlockers.length} para abrir os criativos` : " · pronto para os criativos"}
                </span>
              </div>
            ) : null}
          </section>
        ) : null}

        {isContent ? (
          <section className="panel plan-packages">
            <div className="panel-head">
              <div>
                <h2>Pacotes de produção</h2>
                <p>Agrupe as entregas e escolha se o pacote exige captação ou segue direto para criação.</p>
              </div>
            </div>
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
                              type="date" autoFocus aria-label={`Data sugerida para ${c.label}`}
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
                  <select aria-label="Tipo do novo pacote" value={newPackageKind} onChange={(event) => setNewPackageKind(event.target.value as PlanCaptacao["packageKind"])}>
                    <option value="creation">Pacote de criação</option>
                    <option value="capture">Exige captação</option>
                  </select>
                  <button className="secondary-button" type="submit"><Plus size={13} /></button>
                </form>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Conteúdo, calendário e aprovação: mesma lista, três leituras. */}
        <section className="panel list-panel">
          <div className="plan-tabs" role="tablist">
            {abas.map((item) => (
              <button
                key={item.value}
                role="tab"
                type="button"
                aria-selected={aba === item.value}
                onClick={() => setAba(item.value)}
              >
                {item.label}
                {item.count !== undefined ? <em>{item.count}</em> : null}
              </button>
            ))}
            {canEdit && aba === "conteudos" ? (
              <form className="plan-quick-add" onSubmit={addItem}>
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={isContent ? "Adicionar conteúdo" : "Adicionar passo"}
                  maxLength={140}
                  required
                  aria-label="Nome do novo item"
                />
                {isContent ? (
                  <select value={newItemFormatId} onChange={(e) => setNewItemFormatId(e.target.value)} aria-label="Formato do novo item">
                    <option value="">Formato</option>
                    {formatTags.map((t) => <option value={t.id} key={t.id}>{t.label}</option>)}
                  </select>
                ) : null}
                <button type="submit" className="icon-button" aria-label="Adicionar item"><Plus size={14} /></button>
              </form>
            ) : null}
          </div>

          {aba === "conteudos" ? (
            <>
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
                  <p>Use o campo acima para adicionar o primeiro.</p>
                </div>
              ) : null}
            </>
          ) : null}

          {aba === "calendario" && isContent ? (
            <PlanCalendar tasks={tasks} formatTags={formatTags} canEdit={canEdit} onMove={moveTaskDate} onOpen={setEditingTask} />
          ) : null}

          {aba === "aprovacao" ? (
            <PlanApprovalBoard
              tasks={tasks}
              approvalByTask={approvalByTask}
              responsesByTask={responsesByTask}
              memberById={memberById}
              onOpenTask={setEditingTask}
            />
          ) : null}
        </section>
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
