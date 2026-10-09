"use client";

import { AlertTriangle, ArrowLeft, CalendarDays, ChevronRight, ClipboardList, FolderInput, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useConfirm } from "@/components/confirm-dialog";
import { StatusTag, statusColorMap } from "@/components/status-tag";
import { TaskModal } from "@/components/task-modal";
import { Button, Card, Count, Progress, Segmented, Tag } from "@/components/vz";
import { planStageLabel, planStageTone } from "@/lib/approval-workflow";
import { formatDueDate, overdueDays } from "@/lib/dates";
import { QUEUE_SCOPES, groupByFormat, inQueueScope, planProgress, queueSummary, type QueueScope } from "@/lib/plan-queue";
import { networkError, responseError } from "@/lib/request-error";
import { PLAN_KINDS } from "@/lib/types";
import type { Member, Plan, PlanCaptacao, PlanKind, PlanStage, Project, StatusColor, Tag as TagModel, Task, UserRole } from "@/lib/types";

type PlanosViewProps = {
  projects: Project[];
  initialPlans: Plan[];
  initialTasks: Task[];
  /** Cliente aberto. Sem ele, a tela é a escolha de cliente. */
  selectedProjectId?: string;
  planStages: Record<string, PlanStage>;
  captacoes: PlanCaptacao[];
  members: Member[];
  formatTags: TagModel[];
  channelTags: TagModel[];
  categoryTags: TagModel[];
  statusColors: StatusColor[];
  currentUserId: string;
  currentUserRole: UserRole;
  canPlan: boolean;
  today: string;
};

const KIND_LABEL: Record<PlanKind, string> = { content: "Conteúdo", process: "Processo", presentation: "Apresentação", brand: "Marca" };

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function PlanosView(props: PlanosViewProps) {
  const { projects, selectedProjectId } = props;
  const [plans, setPlans] = useState(props.initialPlans);
  const [tasks, setTasks] = useState(props.initialTasks);
  const selected = projects.find((project) => project.id === selectedProjectId);
  return selected
    ? <ClientQueue {...props} project={selected} plans={plans} setPlans={setPlans} tasks={tasks} setTasks={setTasks} />
    : <ClientPicker {...props} plans={plans} tasks={tasks} />;
}

// ---------- Escolha do cliente ----------
// A porta de entrada. Cada cartão responde, antes do clique, "tem coisa minha
// aqui?" — o número grande é o que está na mão de quem cria.
function ClientPicker({ projects, plans, tasks, today, currentUserId, currentUserRole }: PlanosViewProps & { plans: Plan[]; tasks: Task[] }) {
  const [query, setQuery] = useState("");
  const creative = currentUserRole === "diretor_criativo";
  const clients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return projects
      .filter((project) => !normalized || project.name.toLocaleLowerCase("pt-BR").includes(normalized))
      .map((project) => {
        const own = tasks.filter((task) => task.projectId === project.id);
        return {
          project,
          summary: queueSummary(own, today),
          mine: queueSummary(own.filter((task) => task.assigneeId === currentUserId), today).toCreate,
          plans: plans.filter((plan) => plan.projectId === project.id).length,
        };
      })
      .sort((a, b) => b.summary.late - a.summary.late || b.summary.toCreate - a.summary.toCreate || b.summary.open - a.summary.open || a.project.name.localeCompare(b.project.name, "pt-BR"));
  }, [projects, plans, tasks, today, query, currentUserId]);

  return (
    <main className="admin-page dashboard plan-screen pq-page">
      <div className="vz-pagehead">
        <div className="vz-pagehead__text">
          <span className="vz-eyebrow">Operação</span>
          <h1 className="vz-h1">Planos</h1>
          <p className="vz-caption">Escolha o cliente para ver o que há para entregar, por formato e em ordem de prioridade.</p>
        </div>
        <div className="vz-pagehead__actions">
          <div className="vz-plan-search pq-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente…" aria-label="Buscar cliente" /></div>
        </div>
      </div>

      {clients.length ? (
        <div className="pq-clients">
          {clients.map(({ project, summary, mine, plans: planCount }) => (
            <Link key={project.id} href={`/planos?cliente=${project.id}`} className={`vz-card vz-card--interactive pq-client${summary.open ? "" : " is-idle"}`}>
              <div className="pq-client__head">
                <strong>{project.name}</strong>
                {summary.late ? <Tag tone="red" icon={<AlertTriangle size={11} />}>{plural(summary.late, "atrasada", "atrasadas")}</Tag> : null}
              </div>
              <div className="pq-client__number">
                <b>{summary.toCreate}</b>
                <span>para criar{creative && summary.toCreate ? ` · ${mine} com você` : ""}</span>
              </div>
              <div className="pq-client__foot">
                <span>{plural(summary.open, "demanda aberta", "demandas abertas")} · {plural(planCount, "plano", "planos")}</span>
                <ChevronRight size={15} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="vz-empty"><span className="vz-empty__icon"><ClipboardList size={22} /></span><h3>{query ? "Nenhum cliente encontrado" : "Nenhum cliente disponível"}</h3><p>{query ? "Tente buscar por outro nome." : "Você ainda não está na equipe de nenhum cliente."}</p></div>
      )}
    </main>
  );
}

// ---------- A fila do cliente ----------
function ClientQueue({
  project, projects, plans, setPlans, tasks, setTasks, planStages, captacoes, members, formatTags, channelTags, categoryTags, statusColors,
  currentUserId, currentUserRole, canPlan, today,
}: PlanosViewProps & { project: Project; plans: Plan[]; setPlans: React.Dispatch<React.SetStateAction<Plan[]>>; tasks: Task[]; setTasks: React.Dispatch<React.SetStateAction<Task[]>> }) {
  const router = useRouter();
  const creative = currentUserRole === "diretor_criativo";
  const [scope, setScope] = useState<QueueScope>(creative ? "criar" : "abertas");
  const [onlyMine, setOnlyMine] = useState(creative);
  const [query, setQuery] = useState("");
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [openingId, setOpeningId] = useState("");
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [toast, setToast] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  const colorByStatus = useMemo(() => statusColorMap(statusColors), [statusColors]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const clientPlans = useMemo(() => plans.filter((plan) => plan.projectId === project.id), [plans, project.id]);
  const planById = useMemo(() => new Map(clientPlans.map((plan) => [plan.id, plan])), [clientPlans]);
  const clientTasks = useMemo(() => tasks.filter((task) => task.projectId === project.id), [tasks, project.id]);
  const summary = queueSummary(clientTasks, today);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return clientTasks.filter((task) =>
      inQueueScope(task.status, scope)
      && (!onlyMine || task.assigneeId === currentUserId)
      && (!normalized || task.name.toLocaleLowerCase("pt-BR").includes(normalized)));
  }, [clientTasks, scope, onlyMine, query, currentUserId]);
  const groups = useMemo(() => groupByFormat(visible, formatTags, today), [visible, formatTags, today]);

  // Só recebe tarefa o plano que ainda está andando e que é feito de tarefas.
  const progressByPlan = useMemo(() => new Map(clientPlans.map((plan) => [plan.id, planProgress(clientTasks.filter((task) => task.planId === plan.id))])), [clientPlans, clientTasks]);
  const activePlans = clientPlans.filter((plan) => !progressByPlan.get(plan.id)?.finished);
  const finishedPlans = clientPlans.filter((plan) => progressByPlan.get(plan.id)?.finished);
  const targetPlans = activePlans.filter((plan) => plan.kind === "content" || plan.kind === "process");

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  // A fila carrega a versão leve da tarefa; o modal precisa da completa.
  async function openTask(task: Task) {
    if (openingId) return;
    setOpeningId(task.id);
    try {
      const response = await fetch(`/api/tasks/${task.id}?detail=1`, { cache: "no-store" });
      if (!response.ok) return showToast(await responseError(response, "abrir a tarefa"));
      const result = await response.json() as { task: Task };
      setEditingTask(result.task);
    } catch {
      showToast(networkError("abrir a tarefa"));
    } finally {
      setOpeningId("");
    }
  }

  async function moveToPlan(task: Task, planId: string) {
    const plan = planById.get(planId);
    if (!plan) return;
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, planId } : item)));
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) });
      if (!response.ok) {
        setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, planId: undefined } : item)));
        return showToast(await responseError(response, "mover a tarefa para o plano"));
      }
      showToast(`“${task.name}” agora faz parte de ${plan.title}.`);
    } catch {
      setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, planId: undefined } : item)));
      showToast(networkError("mover a tarefa para o plano"));
    }
  }

  async function removePlan(plan: Plan) {
    if (!(await confirm({ title: "Excluir plano", message: `Excluir o plano "${plan.title}"? Os itens (tarefas) dele também serão excluídos.`, confirmLabel: "Excluir", danger: true }))) return;
    const response = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
    if (!response.ok) return showToast("Não foi possível excluir o plano.");
    setPlans((current) => current.filter((item) => item.id !== plan.id));
    setTasks((current) => current.filter((task) => task.planId !== plan.id));
    showToast("Plano excluído.");
  }

  function onTaskSaved(task: Task) {
    setTasks((current) => (current.some((item) => item.id === task.id) ? current.map((item) => (item.id === task.id ? { ...item, ...task } : item)) : [...current, task]));
  }

  function renderPlan(plan: Plan) {
    const progress = progressByPlan.get(plan.id)!;
    const stage = planStages[plan.id] || "rascunho";
    return (
      <li key={plan.id} className="pq-plan">
        <Link href={`/planos/${plan.id}`} className="pq-plan__main">
          <strong>{plan.title}</strong>
          <span>{KIND_LABEL[plan.kind]}{progress.total ? ` · ${progress.done} de ${plural(progress.total, "item finalizado", "itens finalizados")}` : plan.kind === "presentation" ? "" : " · sem itens ainda"}</span>
          {progress.total ? <Progress value={progress.done} total={progress.total} thin /> : null}
        </Link>
        <div className="pq-plan__side">
          {progress.open ? <Count>{progress.open}</Count> : null}
          <span className={`status ${planStageTone(stage)}`} title="Etapa calculada a partir das rodadas de aprovação do cliente">{planStageLabel(stage)}</span>
          {canPlan ? <button className="icon-button" type="button" onClick={() => removePlan(plan)} title="Excluir" aria-label={`Excluir ${plan.title}`}><Trash2 size={14} /></button> : null}
        </div>
      </li>
    );
  }

  return (
    <>
      <main className="admin-page dashboard plan-screen pq-page">
        <div className="vz-pagehead">
          <div className="vz-pagehead__text">
            <Link href="/planos" className="vz-eyebrow pq-back"><ArrowLeft size={12} /> Clientes</Link>
            <h1 className="vz-h1">{project.name}</h1>
            <div className="vz-plan-tags">
              <Tag tone="violet">{summary.toCreate} para criar</Tag>
              <Tag outline>{plural(summary.open, "demanda aberta", "demandas abertas")}</Tag>
              {summary.late ? <Tag tone="red" icon={<AlertTriangle size={11} />}>{plural(summary.late, "atrasada", "atrasadas")}</Tag> : null}
            </div>
          </div>
          <div className="vz-pagehead__actions">
            <select className="vz-select vz-select--sm pq-switch" value={project.id} onChange={(event) => router.push(`/planos?cliente=${event.target.value}`)} aria-label="Trocar de cliente">
              {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {canPlan ? <Button type="button" variant="primary" size="sm" onClick={() => setNewPlanOpen(true)}><Plus size={14} /> Novo plano</Button> : null}
          </div>
        </div>

        <Card className="vz-plan-content-card">
          <div className="pq-bar">
            <Segmented size="sm" value={scope} onChange={setScope} options={QUEUE_SCOPES} />
            <label className="pq-mine"><input type="checkbox" checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)} /> Só as minhas</label>
            <div className="vz-plan-search pq-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar demanda…" aria-label="Buscar demanda" /></div>
          </div>

          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <div className="plan-group-label pq-group">{group.label} <em>{group.tasks.length}</em>{group.late ? <span className="pq-group__late">{plural(group.late, "atrasada", "atrasadas")}</span> : null}</div>
              <ul className="plan-item-list">
                {group.tasks.map((task, index) => {
                  const assignee = task.assigneeId ? memberById.get(task.assigneeId) : undefined;
                  const late = overdueDays(task.dueDate, task.status, today);
                  const plan = task.planId ? planById.get(task.planId) : undefined;
                  return (
                    <li key={task.id} className={`plan-item-row pq-row${late ? " is-late" : ""}${openingId === task.id ? " is-opening" : ""}`}>
                      <button type="button" className="pq-row__main" onClick={() => openTask(task)}>
                        <span className="pq-row__order">{index + 1}</span>
                        <span className="pq-row__text">
                          <strong>{task.name}</strong>
                          <span className="plan-item-row-meta">
                            <span className={plan ? "pq-row__plan" : "pq-row__plan is-loose"}>{plan ? plan.title : "Avulsa, fora de plano"}</span>
                            {assignee ? <span className="plan-item-assignee"><Avatar name={assignee.name} imageUrl={assignee.avatarUrl} size={16} /> {assignee.name}</span> : <span className="plan-item-assignee">Sem responsável</span>}
                          </span>
                        </span>
                      </button>
                      <div className="plan-item-row-side">
                        {!plan && canPlan && targetPlans.length ? (
                          <label className="pq-move" title="Colocar esta tarefa dentro de um plano">
                            <FolderInput size={13} />
                            <select value="" onChange={(event) => { if (event.target.value) void moveToPlan(task, event.target.value); }} aria-label={`Mover ${task.name} para um plano`}>
                              <option value="">Mover para plano…</option>
                              {targetPlans.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                            </select>
                          </label>
                        ) : null}
                        {late
                          ? <span className="pq-due is-late"><AlertTriangle size={11} /> Atrasada há {plural(late, "dia", "dias")}</span>
                          : <span className="plan-item-due"><CalendarDays size={11} /> {formatDueDate(task.dueDate)}</span>}
                        <StatusTag status={task.status} colorByStatus={colorByStatus} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {!groups.length ? (
            <div className="vz-empty">
              <span className="vz-empty__icon"><ClipboardList size={22} /></span>
              <h3>{query ? "Nenhuma demanda encontrada" : scope === "criar" ? "Nada para criar agora" : scope === "concluidas" ? "Nada finalizado ainda" : "Nenhuma demanda aberta"}</h3>
              <p>{onlyMine ? "Não há demandas com você neste filtro." : "Este cliente não tem demandas neste filtro."}</p>
              {onlyMine ? <Button type="button" variant="secondary" size="sm" onClick={() => setOnlyMine(false)}>Ver de toda a equipe</Button> : null}
            </div>
          ) : null}
        </Card>

        <Card className="pq-plans">
          <div className="vz-card__head">
            <div className="vz-card__title">
              <h3 className="vz-h3">Planos deste cliente</h3>
              <span className="vz-caption">Abra um plano para ver calendário, pacotes e a aprovação do cliente.</span>
            </div>
          </div>
          {activePlans.length ? <ul className="pq-plan-list">{activePlans.map(renderPlan)}</ul> : <p className="pq-plans__empty">Nenhum plano em andamento.{canPlan ? " Crie o primeiro em “Novo plano”." : ""}</p>}
          {finishedPlans.length ? (
            <details className="pq-finished">
              <summary>Planos finalizados <em>{finishedPlans.length}</em></summary>
              <ul className="pq-plan-list">{finishedPlans.map(renderPlan)}</ul>
            </details>
          ) : null}
        </Card>
      </main>

      {editingTask ? (
        <TaskModal
          task={editingTask}
          projects={[project]}
          members={members}
          formatTags={formatTags}
          channelTags={channelTags}
          categoryTags={categoryTags}
          statusColors={statusColors}
          captacoes={captacoes.filter((captacao) => captacao.planId === editingTask.planId)}
          defaultProjectId={project.id}
          allowDeleteAndDuplicate={canPlan}
          canDelete={canPlan}
          currentUserId={currentUserId}
          onClose={() => setEditingTask(undefined)}
          onSaved={onTaskSaved}
          onDeleted={(id) => { setTasks((current) => current.filter((task) => task.id !== id)); setEditingTask(undefined); }}
          onDuplicated={onTaskSaved}
          onTagCreated={() => {}}
        />
      ) : null}
      {newPlanOpen ? <NewPlanDialog project={project} onClose={() => setNewPlanOpen(false)} onCreated={(plan) => router.push(`/planos/${plan.id}`)} /> : null}
      {ConfirmDialog}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}

function NewPlanDialog({ project, onClose, onCreated }: { project: Project; onClose: () => void; onCreated: (plan: Plan) => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<PlanKind>("content");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return setError("Informe o título do plano.");
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, projectId: project.id, kind }) });
      const result = await response.json();
      if (!response.ok) return setError(result.error || "Não foi possível criar o plano.");
      onCreated(result.plan);
    } catch {
      setError(networkError("criar o plano"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" type="button" aria-label="Fechar criação de plano" onClick={onClose} />
      <form className="vz-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-plan-title">
        <div className="vz-modal__head">
          <div><span className="vz-eyebrow">{project.name}</span><h2 className="vz-h2" id="new-plan-title">Novo plano</h2></div>
          <button type="button" className="vz-icon-btn vz-icon-btn--sm" onClick={onClose} aria-label="Fechar"><X size={15} /></button>
        </div>
        <div className="vz-modal__body pq-form">
          {error ? <div className="form-message" role="alert">{error}</div> : null}
          <label className="vz-field"><span className="vz-label">Título do plano</span><input className="vz-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Novembro/2026 — Conteúdo orgânico" maxLength={140} required autoFocus /></label>
          <label className="vz-field"><span className="vz-label">Tipo</span>
            <select className="vz-select" value={kind} onChange={(event) => setKind(event.target.value as PlanKind)}>
              {PLAN_KINDS.filter((item) => item.value !== "brand").map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
            <span className="vz-hint">Os conteúdos e pacotes você adiciona dentro do plano.</span>
          </label>
        </div>
        <div className="vz-modal__foot"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary" disabled={saving}><Plus size={14} />{saving ? "Criando…" : "Criar plano"}</Button></div>
      </form>
    </div>
  );
}
