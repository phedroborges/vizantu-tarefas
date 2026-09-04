"use client";

import NextLink from "next/link";

import { Copy, Folders, Link2, Pencil, Search, Trash2, X, IdCard } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfirm } from "@/components/confirm-dialog";
import { Avatar } from "@/components/avatar";
import { AvatarPicker } from "@/components/avatar-picker";
import { PROJECT_STATUSES } from "@/lib/types";
import type { Project, ProjectStatus, Task } from "@/lib/types";

function statusLabel(status: ProjectStatus) {
  return PROJECT_STATUSES.find((item) => item.value === status)?.label || status;
}

export function ProjetosView({
  initialProjects,
  initialTasks,
  canEdit = true,
}: {
  initialProjects: Project[];
  initialTasks: Task[];
  canEdit?: boolean;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [clientRole, setClientRole] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientInstagram, setClientInstagram] = useState("");
  const [linksByProject, setLinksByProject] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<ProjectStatus>("ativo");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState("");
  const { confirm, ConfirmDialog } = useConfirm();

  const taskStats = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    initialTasks.forEach((task) => {
      const current = map.get(task.projectId) || { total: 0, done: 0 };
      current.total += 1;
      if (task.status === "finalizado") current.done += 1;
      map.set(task.projectId, current);
    });
    return map;
  }, [initialTasks]);

  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter((project) => `${project.name} ${project.client || ""}`.toLowerCase().includes(normalized));
  }, [projects, query]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setClient("");
    setClientRole("");
    setClientCity("");
    setClientInstagram("");
    setAvatarUrl(null);
    setAvatarColor(null);
    setStatus("ativo");
    setError("");
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setName(project.name);
    setClient(project.client || "");
    setClientRole(project.clientRole || "");
    setClientCity(project.clientCity || "");
    setClientInstagram(project.clientInstagram || "");
    setAvatarUrl(project.avatarUrl ?? null);
    setAvatarColor(project.avatarColor ?? null);
    setStatus(project.status);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError("Informe o nome do projeto.");
    setError("");
    setIsSaving(true);
    const response = await fetch(editingId ? `/api/projects/${editingId}` : "/api/projects", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, client, clientRole, clientCity, clientInstagram, avatarUrl, avatarColor, status }),
    });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) return setError(result.error || "Não foi possível salvar o projeto.");
    setProjects((current) => {
      const exists = current.some((item) => item.id === result.project.id);
      const next = exists
        ? current.map((item) => (item.id === result.project.id ? result.project : item))
        : [result.project, ...current];
      return next.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    });
    showToast(editingId ? "Projeto atualizado." : "Projeto criado.");
    resetForm();
  }

  // O painel do cliente vive no mesmo app (/c/[token]) — o link é só um
  // token que resolve pro projeto.
  async function generateLink(project: Project) {
    const response = await fetch(`/api/projects/${project.id}/link`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) return showToast("Não foi possível gerar o link.");
    const url = `${window.location.origin}/c/${result.link.token}`;
    setLinksByProject((current) => ({ ...current, [project.id]: url }));
    await navigator.clipboard.writeText(url).catch(() => {});
    showToast("Link gerado e copiado.");
  }

  function copyExisting(project: Project) {
    const url = linksByProject[project.id];
    if (url) navigator.clipboard.writeText(url).then(() => showToast("Link copiado."));
  }

  async function remove(project: Project) {
    if (!(await confirm({ title: "Excluir projeto", message: `Excluir "${project.name}"? As tarefas desse projeto também serão excluídas.`, confirmLabel: "Excluir", danger: true }))) return;
    const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!response.ok) return showToast("Não foi possível excluir o projeto.");
    setProjects((current) => current.filter((item) => item.id !== project.id));
    if (editingId === project.id) resetForm();
    showToast("Projeto excluído.");
  }

  return (
    <>
      <main className="admin-page dashboard">
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">Operação</span>
            <h1>Projetos</h1>
            <p>Cadastre os projetos e clientes do time e acompanhe o andamento das tarefas de cada um.</p>
          </div>
          <div className="stats" style={{ display: "flex", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
            <div className="stat"><strong>{projects.length}</strong><span>projetos</span></div>
          </div>
        </div>
        <div className="split-layout" style={!canEdit ? { gridTemplateColumns: "1fr" } : undefined}>
          {canEdit ? (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{editingId ? "Editar projeto" : "Novo projeto"}</h2>
                  <p>{editingId ? "Atualize os dados do projeto." : "Cadastre um novo cliente ou projeto interno."}</p>
                </div>
              </div>
              <form className="modal-body" onSubmit={submit} style={{ padding: "24px 25px 27px" }}>
                {error ? <div className="form-message">{error}</div> : null}
                <div className="field">
                  <label>Foto ou cor do cliente</label>
                  <AvatarPicker
                    name={name || "Novo projeto"}
                    imageUrl={avatarUrl}
                    color={avatarColor}
                    withColor
                    onChange={(next) => {
                      if (next.avatarUrl !== undefined) setAvatarUrl(next.avatarUrl);
                      if (next.avatarColor !== undefined) setAvatarColor(next.avatarColor);
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="project-name">Nome do projeto</label>
                  <input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Tawper" required maxLength={120} />
                </div>
                <div className="field">
                  <label htmlFor="project-client">Cliente</label>
                  <input id="project-client" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Opcional" maxLength={120} />
                </div>
                <div className="field">
                  <label htmlFor="project-role">Cargo / área do cliente</label>
                  <input id="project-role" value={clientRole} onChange={(e) => setClientRole(e.target.value)} placeholder="Ex.: Médica" maxLength={80} />
                </div>
                <div className="field">
                  <label htmlFor="project-city">Cidade</label>
                  <input id="project-city" value={clientCity} onChange={(e) => setClientCity(e.target.value)} placeholder="Ex.: Mineiros - GO" maxLength={80} />
                </div>
                <div className="field">
                  <label htmlFor="project-insta">Instagram</label>
                  <input id="project-insta" value={clientInstagram} onChange={(e) => setClientInstagram(e.target.value)} placeholder="@perfil" maxLength={80} />
                </div>
                <div className="field">
                  <label htmlFor="project-status">Status</label>
                  <select id="project-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                    {PROJECT_STATUSES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="primary-button" type="submit" disabled={isSaving} style={{ flex: 1 }}>{isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar projeto"}</button>
                  {editingId ? <button className="secondary-button" type="button" onClick={resetForm}><X size={15} /></button> : null}
                </div>
              </form>
            </section>
          ) : null}

          <section className="panel list-panel">
            <div className="toolbar">
              <div className="search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por projeto ou cliente" aria-label="Buscar projetos" /></div>
              <span style={{ color: "var(--muted-text)", fontSize: 12 }}>{visibleProjects.length} {visibleProjects.length === 1 ? "resultado" : "resultados"}</span>
            </div>
            {visibleProjects.length ? (
              <ul className="project-list">
                {visibleProjects.map((project) => {
                  const stats = taskStats.get(project.id) || { total: 0, done: 0 };
                  const rate = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
                  return (
                    <li className="project-row" key={project.id}>
                      <div className="project-row-title" style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <Avatar name={project.name} imageUrl={project.avatarUrl} color={project.avatarColor} size={34} />
                        <span style={{ display: "grid", minWidth: 0 }}>
                          <strong>{project.name}</strong>
                          <span>{project.client || "Sem cliente definido"}</span>
                        </span>
                      </div>
                      <div className="project-row-progress">
                        <span>{stats.done}/{stats.total} tarefas concluídas</span>
                        <div className="project-progress"><span style={{ width: `${rate}%` }} /></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <span className={`status ${project.status === "concluido" ? "feita" : project.status === "pausado" ? "atrasada" : "em_andamento"}`}>{statusLabel(project.status)}</span>
                        {canEdit ? (
                          <>
                            {linksByProject[project.id] ? (
                              <button className="icon-button" type="button" onClick={() => copyExisting(project)} title="Copiar link do cliente" aria-label={`Copiar link de ${project.name}`}><Copy size={14} /></button>
                            ) : (
                              <button className="icon-button" type="button" onClick={() => generateLink(project)} title="Gerar link do cliente" aria-label={`Gerar link de ${project.name}`}><Link2 size={14} /></button>
                            )}
                            <NextLink className="icon-button" href={`/projetos/${project.id}`} title="Abrir perfil do cliente" aria-label={`Perfil de ${project.name}`}><IdCard size={14} /></NextLink>
                            <button className="icon-button" type="button" onClick={() => startEdit(project)} title="Editar" aria-label={`Editar ${project.name}`}><Pencil size={14} /></button>
                            <button className="icon-button" type="button" onClick={() => remove(project)} title="Excluir" aria-label={`Excluir ${project.name}`}><Trash2 size={14} /></button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty-state">
                <Folders size={35} />
                <h3>{query ? "Nenhum projeto encontrado" : "Cadastre o primeiro projeto"}</h3>
                <p>{query ? "Tente buscar por outro nome." : "Use o formulário ao lado para criar seu primeiro projeto ou cliente."}</p>
              </div>
            )}
          </section>
        </div>
      </main>
      {ConfirmDialog}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
