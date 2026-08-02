"use client";

import { ExternalLink, Send, Trash2, X } from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "@/lib/dates";
import { CHANNEL_SUGGESTIONS, TASK_FORMATS, TASK_STATUSES } from "@/lib/types";
import type { Project, Task, TaskFormat, TaskStatus } from "@/lib/types";

type Draft = {
  projectId: string;
  name: string;
  dueDate: string;
  assignee: string;
  description: string;
  driveLink: string;
  format: TaskFormat | "";
  channel: string;
  status: TaskStatus;
};

function draftFromTask(task: Task | null, defaultProjectId: string): Draft {
  return {
    projectId: task?.projectId || defaultProjectId,
    name: task?.name || "",
    dueDate: task?.dueDate || "",
    assignee: task?.assignee || "",
    description: task?.description || "",
    driveLink: task?.driveLink || "",
    format: task?.format || "",
    channel: task?.channel || "",
    status: task?.status || "a_fazer",
  };
}

export function TaskModal({
  task,
  projects,
  defaultProjectId,
  onClose,
  onSaved,
  onDeleted,
}: {
  task: Task | null;
  projects: Project[];
  defaultProjectId: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromTask(task, defaultProjectId));
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(task?.comments || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [error, setError] = useState("");

  const isEditing = Boolean(task);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) return setError("Informe o nome da tarefa.");
    if (!draft.projectId) return setError("Selecione um projeto.");
    setError("");
    setIsSaving(true);
    const payload = {
      projectId: draft.projectId,
      name: draft.name,
      dueDate: draft.dueDate || undefined,
      assignee: draft.assignee,
      description: draft.description,
      driveLink: draft.driveLink,
      format: draft.format || undefined,
      channel: draft.channel,
      status: draft.status,
    };
    const response = await fetch(isEditing ? `/api/tasks/${task!.id}` : "/api/tasks", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) return setError(result.error || "Não foi possível salvar a tarefa.");
    onSaved(result.task);
  }

  async function remove() {
    if (!task) return;
    if (!window.confirm(`Excluir a tarefa "${task.name}"?`)) return;
    const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!response.ok) return setError("Não foi possível excluir a tarefa.");
    onDeleted(task.id);
  }

  async function sendComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task || !commentText.trim()) return;
    setIsSendingComment(true);
    const response = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: commentAuthor || "Equipe", text: commentText }),
    });
    const result = await response.json();
    setIsSendingComment(false);
    if (!response.ok) return setError(result.error || "Não foi possível enviar o comentário.");
    setComments(result.task.comments);
    setCommentText("");
  }

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" type="button" aria-label="Fechar" onClick={onClose} />
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <header className="modal-head">
          <h2 id="task-modal-title">{isEditing ? "Editar tarefa" : "Nova tarefa"}</h2>
          <button type="button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="modal-body">
          {error ? <div className="form-message">{error}</div> : null}
          <form id="task-fields-form" onSubmit={save}>
            <div className="field">
              <label htmlFor="task-name">Nome da tarefa</label>
              <input id="task-name" value={draft.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex.: Carrossel institucional" required maxLength={140} />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="task-project">Projeto</label>
                <select id="task-project" value={draft.projectId} onChange={(e) => update("projectId", e.target.value)} required>
                  <option value="" disabled>Selecione</option>
                  {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="task-status">Status</label>
                <select id="task-status" value={draft.status} onChange={(e) => update("status", e.target.value as TaskStatus)}>
                  {TASK_STATUSES.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="task-due">Data de entrega</label>
                <input id="task-due" type="date" value={draft.dueDate} onChange={(e) => update("dueDate", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="task-assignee">Responsável</label>
                <input id="task-assignee" value={draft.assignee} onChange={(e) => update("assignee", e.target.value)} placeholder="Ex.: Phedro" maxLength={80} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="task-format">Formato</label>
                <select id="task-format" value={draft.format} onChange={(e) => update("format", e.target.value as TaskFormat)}>
                  <option value="">Não definido</option>
                  {TASK_FORMATS.map((format) => <option value={format.value} key={format.value}>{format.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="task-channel">Canal</label>
                <input id="task-channel" list="channel-suggestions" value={draft.channel} onChange={(e) => update("channel", e.target.value)} placeholder="Ex.: Instagram" maxLength={60} />
                <datalist id="channel-suggestions">
                  {CHANNEL_SUGGESTIONS.map((channel) => <option value={channel} key={channel} />)}
                </datalist>
              </div>
            </div>
            <div className="field">
              <label htmlFor="task-drive">Link (Drive)</label>
              <input id="task-drive" type="url" value={draft.driveLink} onChange={(e) => update("driveLink", e.target.value)} placeholder="https://drive.google.com/..." />
              {draft.driveLink ? (
                <a href={draft.driveLink} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--accent-strong)", fontSize: 11 }}>
                  <ExternalLink size={12} /> Abrir link
                </a>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="task-description">O que é para fazer</label>
              <textarea id="task-description" value={draft.description} onChange={(e) => update("description", e.target.value)} placeholder="Descreva o briefing da tarefa" maxLength={2000} />
            </div>
          </form>

          {isEditing ? (
            <div className="field">
              <label>Comentários</label>
              {comments.length ? (
                <ul className="comment-list">
                  {comments.map((comment) => (
                    <li className="comment-item" key={comment.id}>
                      <div><strong>{comment.author}</strong><small>{formatDateTime(comment.createdAt)}</small></div>
                      <p>{comment.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 11 }}>Nenhum comentário ainda.</p>
              )}
              <form className="comment-form" onSubmit={sendComment} style={{ marginTop: 10 }}>
                <input
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  placeholder="Seu nome"
                  style={{ maxWidth: 130 }}
                  maxLength={60}
                />
                <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escreva um comentário" maxLength={600} />
                <button className="icon-button" type="submit" disabled={isSendingComment || !commentText.trim()} aria-label="Enviar comentário"><Send size={15} /></button>
              </form>
            </div>
          ) : null}
        </div>
        <footer className="modal-actions">
          {isEditing ? (
            <button type="button" className="danger-button" onClick={remove}><Trash2 size={14} /> Excluir</button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
            <button type="submit" form="task-fields-form" className="primary-button" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
