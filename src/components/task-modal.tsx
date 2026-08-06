"use client";

import { AlignLeft, CalendarDays, Check, ExternalLink, Folder, Link2, Send, Share2, Trash2, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetaRow } from "@/components/meta-row";
import { TagPicker } from "@/components/tag-picker";
import { TaskStatusControl } from "@/components/task-status-control";
import { formatDateTime, isOverdue, todayIso } from "@/lib/dates";
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
const NO_PROJECT = "none";

// A IA escreve as descrições em Markdown; sem tratar, os **negritos** apareciam
// crus, com asteriscos. Renderiza só o negrito, como nós de texto React (nada de
// HTML injetado) — as listas e quebras de linha já vêm do pre-wrap do container.
function renderDescription(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, index) => {
    const bold = /^\*\*([^*\n]+)\*\*$/.exec(part);
    return bold ? <strong key={index}>{bold[1]}</strong> : <span key={index}>{part}</span>;
  });
}

// Numa tarefa nova, pré-preenche entrega (hoje) e responsável (quem está
// criando) — menos campo pra preencher no caso mais comum. Numa tarefa
// existente sem esses valores, mantém vazio (não força um valor que não foi
// escolhido por ninguém).
function draftFromTask(task: Task | null, defaultProjectId: string, currentUserId: string): Draft {
  return {
    projectId: task?.projectId || defaultProjectId,
    name: task?.name || "",
    dueDate: task ? task.dueDate || "" : todayIso(),
    assigneeId: task ? task.assigneeId || NO_ASSIGNEE : currentUserId || NO_ASSIGNEE,
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
  canEdit = true,
  currentUserId,
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
  canEdit?: boolean;
  currentUserId: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted: (id: string) => void;
  onTagCreated: (tag: Tag) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromTask(task, defaultProjectId, currentUserId));
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(task?.comments || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [error, setError] = useState("");
  const [editingLink, setEditingLink] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.name]);

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
    if (!draft.projectId || draft.projectId === NO_PROJECT) return setError("Selecione um projeto.");
    setError("");
    setIsSaving(true);
    const payload = {
      projectId: draft.projectId,
      name: draft.name,
      dueDate: draft.dueDate || undefined,
      assigneeId: draft.assigneeId === NO_ASSIGNEE ? null : draft.assigneeId,
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

  async function copyLink() {
    if (!task) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/tarefas/${task.id}`);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar o link.");
    }
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
    // O usuário está logado — assina o comentário com o nome dele, sem pedir.
    const author = members.find((member) => member.id === currentUserId)?.name || "Equipe";
    const response = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, text: commentText }),
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
  // sem isso ele exibe o value bruto (id) em vez do nome.
  const assigneeLabels: Record<string, string> = {
    [NO_ASSIGNEE]: "Sem responsável",
    ...Object.fromEntries(assigneeOptions.map((member) => [member.id, member.name])),
    ...(currentInactiveAssignee ? { [currentInactiveAssignee.id]: `${currentInactiveAssignee.name} (inativo)` } : {}),
  };
  const projectLabels: Record<string, string> = Object.fromEntries(projects.map((project) => [project.id, project.name]));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-[920px] w-[calc(100%-2rem)] max-h-[min(860px,calc(100vh-3rem))] flex flex-col gap-0 overflow-hidden p-0" showCloseButton>
        <DialogHeader className="modal-head task-modal-head">
          <DialogTitle className="sr-only">{draft.name || (isEditing ? "Editar tarefa" : "Nova tarefa")}</DialogTitle>
          <textarea
            ref={titleRef}
            className="meta-title-input"
            value={draft.name}
            onChange={(e) => update("name", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Nome da tarefa"
            rows={1}
            required
            maxLength={140}
          />
          {isEditing ? (
            <button type="button" className="icon-button" onClick={copyLink} title="Copiar link da tarefa" aria-label="Copiar link da tarefa">
              {linkCopied ? <Check size={14} /> : <Share2 size={14} />}
            </button>
          ) : null}
        </DialogHeader>
        <div className="modal-body">
          {error ? <div className="form-message">{error}</div> : null}
          <form id="task-fields-form" onSubmit={save} className="task-modal-split">
            <div className="task-modal-pane-meta meta-rows">
              <MetaRow icon={<Folder size={13} />} label="Projeto">
                <Select items={projectLabels} value={draft.projectId || NO_PROJECT} onValueChange={(value) => update("projectId", value ?? NO_PROJECT)}>
                  <SelectTrigger className="meta-trigger">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </MetaRow>

              <MetaRow icon={<User size={13} />} label="Responsável">
                <Select items={assigneeLabels} value={draft.assigneeId} onValueChange={(value) => update("assigneeId", value ?? NO_ASSIGNEE)}>
                  <SelectTrigger className="meta-trigger">
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
              </MetaRow>

              <TaskStatusControl status={draft.status} statusHistory={task?.statusHistory ?? []} dueDate={draft.dueDate} onChange={(value) => update("status", value)} />

              <MetaRow icon={<CalendarDays size={13} />} label="Entrega">
                <input
                  className="meta-date"
                  type="date"
                  value={draft.dueDate}
                  disabled={dateLocked}
                  onChange={(e) => update("dueDate", e.target.value)}
                />
              </MetaRow>
              {dateLocked ? (
                <p className="form-message" style={{ marginTop: -4 }}>
                  Esta tarefa está atrasada — a data não pode ser alterada. Mude o status para &quot;Aprovado&quot;, &quot;Problema&quot; ou &quot;Finalizado&quot; se o atraso não depender mais dela.
                </p>
              ) : null}

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

              <MetaRow icon={<Link2 size={13} />} label="Link (Drive)">
                {editingLink ? (
                  <input
                    className="meta-inline-input"
                    autoFocus
                    type="url"
                    value={draft.driveLink}
                    onChange={(e) => update("driveLink", e.target.value)}
                    onBlur={() => setEditingLink(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setEditingLink(false);
                      }
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setEditingLink(false);
                      }
                    }}
                    placeholder="https://drive.google.com/..."
                  />
                ) : draft.driveLink ? (
                  <span className="meta-link-value">
                    <button type="button" className="meta-value-trigger" onClick={() => setEditingLink(true)}>{draft.driveLink}</button>
                    <a href={draft.driveLink} target="_blank" rel="noreferrer" className="meta-link-open" aria-label="Abrir link">
                      <ExternalLink size={13} />
                    </a>
                  </span>
                ) : (
                  <button type="button" className="meta-value-trigger" onClick={() => setEditingLink(true)}>
                    <span className="meta-empty">Vazio</span>
                  </button>
                )}
              </MetaRow>
            </div>

            <div className="task-modal-pane-desc">
              <span className="meta-row-label task-desc-label"><AlignLeft size={13} /> Descrição</span>
              {editingDescription ? (
                <textarea
                  autoFocus
                  className="task-desc-textarea"
                  value={draft.description}
                  onChange={(e) => update("description", e.target.value)}
                  onBlur={() => setEditingDescription(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setEditingDescription(false);
                    }
                  }}
                  placeholder="Descreva o briefing da tarefa"
                  maxLength={2000}
                />
              ) : (
                <button type="button" className="task-desc-display" onClick={() => setEditingDescription(true)}>
                  {draft.description ? renderDescription(draft.description) : <span className="meta-empty">Vazio — clique para escrever a descrição</span>}
                </button>
              )}
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
              {canEdit ? (
                <form className="comment-form" onSubmit={sendComment} style={{ marginTop: 10 }}>
                  <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Escreva um comentário" maxLength={600} />
                  <button className="icon-button" type="submit" disabled={isSendingComment || !commentText.trim()} aria-label="Enviar comentário"><Send size={15} /></button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
        <footer className="modal-actions">
          {isEditing && canEdit ? (
            <button type="button" className="danger-button" onClick={remove}><Trash2 size={13} /> Excluir</button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="secondary-button" onClick={onClose}>{canEdit ? "Cancelar" : "Fechar"}</button>
            {canEdit ? (
              <button type="submit" form="task-fields-form" className="primary-button" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</button>
            ) : null}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
