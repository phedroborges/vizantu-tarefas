"use client";

import { CalendarDays, Camera, ClipboardList, Copy, Link2, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { TaskModal } from "@/components/task-modal";
import { useConfirm } from "@/components/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDueDate } from "@/lib/dates";
import { TASK_STATUSES } from "@/lib/types";
import type { Member, Plan, PlanCaptacao, PlanClient, Project, StatusColor, Tag, Task } from "@/lib/types";

// URL pública onde o vizantu-planos serve o dashboard do cliente
// (/c/[token]) — configurável porque os dois apps ficam em domínios
// diferentes; sem a env, mostra só o token pro time copiar manualmente.
const PLANOS_PUBLIC_URL = process.env.NEXT_PUBLIC_PLANOS_URL || "";
const NO_CAPTACAO = "none";
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
  members,
  formatTags,
  channelTags,
  categoryTags,
  statusColors,
  initialClients,
  currentUserId,
  canEdit = true,
}: {
  plan: Plan;
  project: Project;
  initialCaptacoes: PlanCaptacao[];
  initialTasks: Task[];
  members: Member[];
  formatTags: Tag[];
  channelTags: Tag[];
  categoryTags: Tag[];
  statusColors: StatusColor[];
  initialClients: PlanClient[];
  currentUserId: string;
  canEdit?: boolean;
}) {
  const [captacoes, setCaptacoes] = useState(initialCaptacoes);
  const [tasks, setTasks] = useState(initialTasks);
  const [clients, setClients] = useState(initialClients);
  const [newCaptacaoLabel, setNewCaptacaoLabel] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemFormatId, setNewItemFormatId] = useState(formatTags[0]?.id || "");
  const [newClientName, setNewClientName] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  const [tokensByClient, setTokensByClient] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  const isContent = plan.kind === "content";

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
      body: JSON.stringify({ planId: plan.id, label: newCaptacaoLabel, sequenceOrder: captacoes.length }),
    });
    const result = await response.json();
    if (!response.ok) return showToast(result.error || "Não foi possível criar a captação.");
    setCaptacoes((current) => [...current, result.captacao]);
    setNewCaptacaoLabel("");
  }

  async function removeCaptacao(captacao: PlanCaptacao) {
    const used = tasks.filter((t) => t.captacaoId === captacao.id).length;
    const message = used
      ? `Remover "${captacao.label}"? ${used} ${used === 1 ? "item fica" : "itens ficam"} sem captação (nada é excluído).`
      : `Remover "${captacao.label}"?`;
    if (!(await confirm({ title: "Remover captação", message, confirmLabel: "Remover", danger: true }))) return;
    const response = await fetch(`/api/plan-captacoes/${captacao.id}`, { method: "DELETE" });
    if (!response.ok) return showToast("Não foi possível remover a captação.");
    setCaptacoes((current) => current.filter((c) => c.id !== captacao.id));
    setTasks((current) => current.map((t) => (t.captacaoId === captacao.id ? { ...t, captacaoId: undefined } : t)));
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

  // Captação é atribuída por item (e é universal: vale pra vídeo, carrossel,
  // estático — qualquer formato pode precisar de uma sessão de captação).
  async function setItemCaptacao(taskId: string, captacaoId: string) {
    const value = captacaoId === NO_CAPTACAO ? null : captacaoId;
    setTasks((current) => current.map((t) => (t.id === taskId ? { ...t, captacaoId: value || undefined } : t)));
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captacaoId: value }),
    });
    if (!response.ok) showToast("Não foi possível mudar a captação.");
  }

  function onTaskSaved(task: Task) {
    setTasks((current) => (current.some((t) => t.id === task.id) ? current.map((t) => (t.id === task.id ? task : t)) : [...current, task]));
  }

  function onTaskDeleted(id: string) {
    setTasks((current) => current.filter((t) => t.id !== id));
    setEditingTask(undefined);
  }

  const formatTagById = useMemo(() => new Map(formatTags.map((t) => [t.id, t])), [formatTags]);
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

  const doneCount = tasks.filter((t) => statusGroup(t.status) === "feita").length;
  const progressRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  async function createClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newClientName.trim()) return;
    const response = await fetch("/api/plan-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: plan.projectId, name: newClientName }),
    });
    const result = await response.json();
    if (!response.ok) return showToast(result.error || "Não foi possível criar o cliente.");
    setClients((current) => [...current, result.client]);
    setNewClientName("");
    setAddingClient(false);
  }

  async function generateToken(clientId: string) {
    const response = await fetch(`/api/plan-clients/${clientId}/tokens`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) return showToast("Não foi possível gerar o link.");
    setTokensByClient((current) => ({ ...current, [clientId]: [...(current[clientId] || []), result.token.token] }));
    showToast("Link gerado.");
  }

  function copyLink(token: string) {
    const url = PLANOS_PUBLIC_URL ? `${PLANOS_PUBLIC_URL}/c/${token}` : `/c/${token}`;
    navigator.clipboard.writeText(url).then(() => showToast("Link copiado."));
  }

  const captacaoLabels: Record<string, string> = {
    [NO_CAPTACAO]: "Sem captação",
    ...Object.fromEntries(captacoes.map((c) => [c.id, c.label])),
  };

  function renderTaskRow(task: Task) {
    const categories = task.categoryTagIds.map((id) => categoryTagById.get(id)?.label).filter(Boolean);
    const assignee = task.assigneeId ? memberById.get(task.assigneeId)?.name : undefined;
    return (
      <li key={task.id} className="plan-item-row">
        <div className="plan-item-row-main" onClick={() => setEditingTask(task)}>
          <strong>{task.name}</strong>
          <div className="plan-item-row-meta">
            {categories.map((label) => <span className="badge channel" key={label}>{label}</span>)}
            {assignee ? <span className="plan-item-assignee">{assignee}</span> : null}
            {task.dueDate ? <span className="plan-item-due"><CalendarDays size={11} /> {formatDueDate(task.dueDate)}</span> : null}
          </div>
        </div>
        <div className="plan-item-row-side">
          {isContent ? (
            canEdit ? (
              <Select items={captacaoLabels} value={task.captacaoId || NO_CAPTACAO} onValueChange={(value) => setItemCaptacao(task.id, value ?? NO_CAPTACAO)}>
                <SelectTrigger className="plan-captacao-select">
                  <SelectValue placeholder="Sem captação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CAPTACAO}>Sem captação</SelectItem>
                  {captacoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <span className="plan-item-assignee">{task.captacaoId ? captacaoById.get(task.captacaoId)?.label : "Sem captação"}</span>
            )
          ) : null}
          <span className={`status ${statusGroup(task.status)}`} onClick={() => setEditingTask(task)}>{statusLabel(task.status)}</span>
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
          <div className="stats" style={{ display: "flex", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
            <div className="stat" style={{ background: "white", minWidth: 110, padding: "15px 18px" }}><strong>{tasks.length}</strong><span>itens</span></div>
            <div className="stat" style={{ background: "white", minWidth: 110, padding: "15px 18px" }}><strong>{progressRate}%</strong><span>concluído</span></div>
          </div>
        </div>

        {tasks.length ? (
          <div className="plan-progress-track" style={{ marginBottom: 22 }}>
            <div className="plan-progress-fill" style={{ width: `${progressRate}%` }} />
          </div>
        ) : null}

        {isContent ? (
          <section className="panel" style={{ marginBottom: 18 }}>
            <div className="panel-head">
              <div>
                <h2><Camera size={15} style={{ verticalAlign: -2 }} /> Captações</h2>
                <p>Sessões de captação do plano — cada item escolhe a sua na lista ao lado.</p>
              </div>
            </div>
            <div className="plan-captacao-row">
              {captacoes.map((c) => {
                const count = tasks.filter((t) => t.captacaoId === c.id).length;
                return (
                  <span key={c.id} className="plan-captacao-chip">
                    {c.label}
                    <em>{count}</em>
                    {canEdit ? <button type="button" onClick={() => removeCaptacao(c)} aria-label={`Remover ${c.label}`}><Trash2 size={11} /></button> : null}
                  </span>
                );
              })}
              {!captacoes.length ? <span className="plan-item-empty">Nenhuma captação ainda.</span> : null}
              {canEdit ? (
                <form onSubmit={addCaptacao} className="plan-captacao-form">
                  <input value={newCaptacaoLabel} onChange={(e) => setNewCaptacaoLabel(e.target.value)} placeholder="Ex.: 1ª Captação" style={{ width: 160 }} />
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

          <section className="panel list-panel">
            <div className="panel-head"><h2>Itens ({tasks.length})</h2></div>
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

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <div>
              <h2><UsersIcon size={15} style={{ verticalAlign: -2 }} /> Cliente e link mágico</h2>
              <p>O link dá acesso ao dashboard de aprovação em vizantu-planos — sem senha, um token por cliente.</p>
            </div>
          </div>
          <div className="plan-client-grid">
            {clients.map((client) => {
              const tokens = tokensByClient[client.id] || [];
              return (
                <div className="plan-client-card" key={client.id}>
                  <strong>{client.name}</strong>
                  {tokens.length ? (
                    <div className="plan-client-tokens">
                      {tokens.map((token) => (
                        <button key={token} type="button" className="secondary-button" onClick={() => copyLink(token)}>
                          <Copy size={12} /> Copiar link
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="plan-item-empty"><Link2 size={11} /> Nenhum link gerado ainda</span>
                  )}
                  {canEdit ? (
                    <button type="button" className="secondary-button" onClick={() => generateToken(client.id)} style={{ alignSelf: "flex-start" }}>
                      Gerar novo link
                    </button>
                  ) : null}
                </div>
              );
            })}
            {canEdit ? (
              addingClient ? (
                <form className="plan-client-card" onSubmit={createClient}>
                  <input
                    autoFocus
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setAddingClient(false)}
                    placeholder="Nome do cliente"
                    maxLength={120}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="submit" className="primary-button" style={{ flex: 1 }}>Criar</button>
                    <button type="button" className="secondary-button" onClick={() => setAddingClient(false)}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <button type="button" className="plan-client-add" onClick={() => setAddingClient(true)}>
                  <Plus size={16} /> Novo cliente
                </button>
              )
            ) : null}
            {!clients.length && !canEdit ? <span className="plan-item-empty">Nenhum cliente cadastrado ainda.</span> : null}
          </div>
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
