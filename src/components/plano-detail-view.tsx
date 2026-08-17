"use client";

import { CalendarDays, ClipboardList, Copy, Film, Link2, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { TaskModal } from "@/components/task-modal";
import { formatDueDate } from "@/lib/dates";
import { TASK_STATUSES } from "@/lib/types";
import type { Member, Plan, PlanCaptacao, PlanClient, Project, StatusColor, Tag, Task } from "@/lib/types";

// URL pública onde o vizantu-planos serve o dashboard do cliente
// (/c/[token]) — configurável porque os dois apps ficam em domínios
// diferentes; sem a env, mostra só o token pro time copiar manualmente.
const PLANOS_PUBLIC_URL = process.env.NEXT_PUBLIC_PLANOS_URL || "";

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
  const [newItemCaptacaoId, setNewItemCaptacaoId] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null | undefined>(undefined);
  const [tokensByClient, setTokensByClient] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState("");

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

  async function removeCaptacao(id: string) {
    if (!window.confirm("Remover esta captação? Os itens dela ficam sem captação.")) return;
    const response = await fetch(`/api/plan-captacoes/${id}`, { method: "DELETE" });
    if (!response.ok) return showToast("Não foi possível remover a captação.");
    setCaptacoes((current) => current.filter((c) => c.id !== id));
    setTasks((current) => current.map((t) => (t.captacaoId === id ? { ...t, captacaoId: undefined } : t)));
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
        captacaoId: isContent ? newItemCaptacaoId || undefined : undefined,
        sequenceOrder: isContent ? undefined : tasks.length,
      }),
    });
    const result = await response.json();
    if (!response.ok) return showToast(result.error || "Não foi possível criar o item.");
    setTasks((current) => [...current, result.task]);
    setNewItemName("");
  }

  function onTaskSaved(task: Task) {
    setTasks((current) => (current.some((t) => t.id === task.id) ? current.map((t) => (t.id === task.id ? task : t)) : [...current, task]));
    setEditingTask(undefined);
  }

  function onTaskDeleted(id: string) {
    setTasks((current) => current.filter((t) => t.id !== id));
    setEditingTask(undefined);
  }

  const itemsByCaptacao = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const key = task.captacaoId || "__none__";
      map.set(key, [...(map.get(key) || []), task]);
    });
    return map;
  }, [tasks]);

  const processItems = useMemo(() => [...tasks].sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0)), [tasks]);
  const formatTagById = useMemo(() => new Map(formatTags.map((t) => [t.id, t])), [formatTags]);
  const categoryTagById = useMemo(() => new Map(categoryTags.map((t) => [t.id, t])), [categoryTags]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const doneCount = tasks.filter((t) => statusGroup(t.status) === "feita").length;
  const scriptedCount = tasks.filter((t) => t.scriptText?.trim()).length;
  const progressRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  async function createClient() {
    const name = window.prompt("Nome do cliente (aparece no cabeçalho do dashboard):");
    if (!name?.trim()) return;
    const response = await fetch("/api/plan-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: plan.projectId, name }),
    });
    const result = await response.json();
    if (!response.ok) return showToast(result.error || "Não foi possível criar o cliente.");
    setClients((current) => [...current, result.client]);
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

  function renderTaskRow(task: Task) {
    const format = task.formatTagIds.map((id) => formatTagById.get(id)?.label).filter(Boolean);
    const categories = task.categoryTagIds.map((id) => categoryTagById.get(id)?.label).filter(Boolean);
    const assignee = task.assigneeId ? memberById.get(task.assigneeId)?.name : undefined;
    return (
      <li key={task.id} className="plan-item-row" onClick={() => setEditingTask(task)}>
        <div className="plan-item-row-main">
          <strong>{task.name}</strong>
          <div className="plan-item-row-meta">
            {format.map((label) => <span className="badge format" key={label}>{label}</span>)}
            {categories.map((label) => <span className="badge channel" key={label}>{label}</span>)}
            {!format.length && !categories.length ? <span className="plan-item-empty">Sem formato/categoria</span> : null}
          </div>
        </div>
        <div className="plan-item-row-side">
          {assignee ? <span className="plan-item-assignee">{assignee}</span> : null}
          {task.dueDate ? <span className="plan-item-due"><CalendarDays size={11} /> {formatDueDate(task.dueDate)}</span> : null}
          <span className={`status ${statusGroup(task.status)}`}>{statusLabel(task.status)}</span>
        </div>
      </li>
    );
  }

  return (
    <>
      <main className="admin-page dashboard">
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">{project.name}</span>
            <h1>{plan.title}</h1>
            <p>{isContent ? "Vídeos, posts e carrosséis agrupados por captação — roteiro, direcionamento, referência e legenda ficam em cada item." : "Passos ordenados do processo."}</p>
          </div>
          <div className="stats" style={{ display: "flex", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
            <div className="stat" style={{ background: "white", minWidth: 110, padding: "15px 18px" }}><strong>{tasks.length}</strong><span>itens</span></div>
            {isContent ? (
              <div className="stat" style={{ background: "white", minWidth: 110, padding: "15px 18px" }}><strong>{scriptedCount}</strong><span>com roteiro</span></div>
            ) : null}
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
            <div className="panel-head"><h2><Film size={15} style={{ verticalAlign: -2 }} /> Captações</h2></div>
            <div className="plan-captacao-row">
              {captacoes.map((c) => (
                <span key={c.id} className="plan-captacao-chip">
                  {c.label}
                  <em>{(itemsByCaptacao.get(c.id) || []).length}</em>
                  {canEdit ? <button type="button" onClick={() => removeCaptacao(c.id)} aria-label={`Remover ${c.label}`}><Trash2 size={11} /></button> : null}
                </span>
              ))}
              {!captacoes.length ? <span className="plan-item-empty">Nenhuma captação ainda — crie a primeira ao lado.</span> : null}
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
                  <input id="item-name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder={isContent ? "Ex.: Vídeo #1 — trends" : "Ex.: E-mail de acesso enviado"} required maxLength={140} />
                </div>
                {isContent ? (
                  <div className="field">
                    <label htmlFor="item-captacao">Captação</label>
                    <select id="item-captacao" value={newItemCaptacaoId} onChange={(e) => setNewItemCaptacaoId(e.target.value)}>
                      <option value="">Sem captação</option>
                      {captacoes.map((c) => <option value={c.id} key={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                ) : null}
                <button className="primary-button" type="submit" style={{ width: "100%" }}>Adicionar item</button>
                <p className="plan-form-hint">Depois de criado, clique no item pra preencher roteiro, direcionamento, referência e legenda.</p>
              </form>
            </section>
          ) : null}

          <section className="panel list-panel">
            <div className="panel-head"><h2>Itens ({tasks.length})</h2></div>
            {isContent ? (
              <>
                {captacoes.map((c) => (
                  <div key={c.id}>
                    <div className="plan-group-label">{c.label}</div>
                    <ul className="plan-item-list">{(itemsByCaptacao.get(c.id) || []).map(renderTaskRow)}</ul>
                  </div>
                ))}
                {itemsByCaptacao.get("__none__")?.length ? (
                  <div>
                    <div className="plan-group-label">Sem captação</div>
                    <ul className="plan-item-list">{itemsByCaptacao.get("__none__")!.map(renderTaskRow)}</ul>
                  </div>
                ) : null}
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
          <div className="panel-head"><h2><UsersIcon size={15} style={{ verticalAlign: -2 }} /> Cliente e link mágico</h2><p>O link dá acesso ao dashboard de aprovação em vizantu-planos — sem senha, um token por cliente.</p></div>
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
              <button type="button" className="plan-client-add" onClick={createClient}>
                <Plus size={16} /> Novo cliente
              </button>
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
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
