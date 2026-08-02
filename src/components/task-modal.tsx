"use client";

import { ExternalLink, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagPicker } from "@/components/tag-picker";
import { TaskStatusControl } from "@/components/task-status-control";
import { formatDateTime, isOverdue } from "@/lib/dates";
import type { Member, Project, Tag, TagKind, Task, TaskStatus } from "@/lib/types";

type Draft = {
  projectId: string;
  name: string;
  dueDate: string;
  assigneeId: string;
  description: string;
  driveLink: string;
  formatTagIds: string[];
  channelTagIds: string[];
  status: TaskStatus;
};

const NO_ASSIGNEE = "none";

function draftFromTask(task: Task | null, defaultProjectId: string): Draft {
  return {
    projectId: task?.projectId || defaultProjectId,
    name: task?.name || "",
    dueDate: task?.dueDate || "",
    assigneeId: task?.assigneeId || NO_ASSIGNEE,
    description: task?.description || "",
    driveLink: task?.driveLink || "",
    formatTagIds: task?.formatTagIds || [],
    channelTagIds: task?.channelTagIds || [],
    status: task?.status || "rascunho",
  };
}

export function TaskModal({
  task,
  projects,
  members,
  formatTags,
  channelTags,
  defaultProjectId,
  onClose,
  onSaved,
  onDeleted,
  onTagCreated,
}: {
  task: Task | null;
  projects: Project[];
  members: Member[];
  formatTags: Tag[];
  channelTags: Tag[];
  defaultProjectId: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted: (id: string) => void;
  onTagCreated: (tag: Tag) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromTask(task, defaultProjectId));
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(task?.comments || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [error, setError] = useState("");

  const isEditing = Boolean(task);
  const dateLocked = isEditing && isOverdue(task!.dueDate, task!.status);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function catalogFor(kind: TagKind): Tag[] {
    return kind === "formato" ? formatTags : channelTags;
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
      assigneeId: draft.assigneeId === NO_ASSIGNEE ? undefined : draft.assigneeId,
      description: draft.description,
      driveLink: draft.driveLink,
      formatTagIds: draft.formatTagIds,
      channelTagIds: draft.channelTagIds,
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

  const assigneeOptions = members.filter((member) => member.active);
  const currentInactiveAssignee =
    task?.assigneeId && !assigneeOptions.some((member) => member.id === task.assigneeId)
      ? members.find((member) => member.id === task.assigneeId)
      : undefined;
  // Base UI's <Select.Value> só resolve o rótulo se o Root receber esse mapa —
  // sem isso ele exibe o value bruto (o id do membro) em vez do nome.
  const assigneeLabels: Record<string, string> = {
    [NO_ASSIGNEE]: "Sem responsável",
    ...Object.fromEntries(assigneeOptions.map((member) => [member.id, member.name])),
    ...(currentInactiveAssignee ? { [currentInactiveAssignee.id]: `${currentInactiveAssignee.name} (inativo)` } : {}),
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[640px] w-[calc(100%-2rem)] max-h-[min(860px,calc(100vh-3rem))] flex flex-col gap-0 overflow-hidden p-0" showCloseButton>
        <DialogHeader className="modal-head">
          <DialogTitle className="modal-title">{isEditing ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
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
                <label htmlFor="task-assignee">Responsável</label>
                <Select items={assigneeLabels} value={draft.assigneeId} onValueChange={(value) => update("assigneeId", value ?? NO_ASSIGNEE)}>
                  <SelectTrigger id="task-assignee" className="select-full">
                    <SelectValue placeholder="Sem responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ASSIGNEE}>Sem responsável</SelectItem>
                    {assigneeOptions.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                    {currentInactiveAssignee ? (
                      <SelectItem value={currentInactiveAssignee.id}>{currentInactiveAssignee.name} (inativo)</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TaskStatusControl status={draft.status} statusHistory={task?.statusHistory ?? []} onChange={(value) => update("status", value)} />

            <div className="field">
              <label htmlFor="task-due">Data de entrega</label>
              <input
                id="task-due"
                type="date"
                value={draft.dueDate}
                disabled={dateLocked}
                onChange={(e) => update("dueDate", e.target.value)}
              />
              {dateLocked ? (
                <p className="form-message">
                  Esta tarefa está atrasada — a data não pode ser alterada. Mude o status para &quot;Aprovado&quot;, &quot;Problema&quot; ou &quot;Finalizado&quot; se o atraso não depender mais dela.
                </p>
              ) : null}
            </div>

            <div className="field-row">
              <TagPicker
                kind="formato"
                label="Formato"
                catalog={catalogFor("formato")}
                selectedIds={draft.formatTagIds}
                onChange={(ids) => update("formatTagIds", ids)}
                onCatalogUpdate={onTagCreated}
              />
              <TagPicker
                kind="canal"
                label="Canal"
                catalog={catalogFor("canal")}
                selectedIds={draft.channelTagIds}
                onChange={(ids) => update("channelTagIds", ids)}
                onCatalogUpdate={onTagCreated}
              />
            </div>

            <div className="field">
              <label htmlFor="task-drive">Link (Drive)</label>
              <input id="task-drive" type="url" value={draft.driveLink} onChange={(e) => update("driveLink", e.target.value)} placeholder="https://drive.google.com/..." />
              {draft.driveLink ? (
                <a href={draft.driveLink} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--brand-strong)", fontSize: 11 }}>
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
                <p style={{ margin: 0, color: "var(--muted-text)", fontSize: 11 }}>Nenhum comentário ainda.</p>
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
      </DialogContent>
    </Dialog>
  );
}
