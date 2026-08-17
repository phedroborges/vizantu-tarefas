"use client";

import { AlignLeft, CalendarDays, Check, Copy, ExternalLink, Folder, ImagePlus, Link2, Loader2, Send, Share2, Trash2, User, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetaRow } from "@/components/meta-row";
import { TagPicker } from "@/components/tag-picker";
import { TaskStatusControl } from "@/components/task-status-control";
import { useConfirm } from "@/components/confirm-dialog";
import { formatDateTime, isOverdue, todayIso } from "@/lib/dates";
import { resizeImageFile } from "@/lib/resize-image";
import type { Member, Project, StatusColor, Tag, TagKind, Task, TaskStatus } from "@/lib/types";

type Draft = {
  projectId: string;
  name: string;
  dueDate: string;
  assigneeId: string;
  description: string;
  images: string[];
  driveLink: string;
  formatTagIds: string[];
  channelTagIds: string[];
  categoryTagIds: string[];
  status: TaskStatus;
};

const NO_ASSIGNEE = "none";
const NO_PROJECT = "none";
const AUTOSAVE_DEBOUNCE_MS = 700;

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
    images: task?.images || [],
    driveLink: task?.driveLink || "",
    formatTagIds: task?.formatTagIds || [],
    channelTagIds: task?.channelTagIds || [],
    categoryTagIds: task?.categoryTagIds || [],
    status: task?.status || "rascunho",
  };
}

function buildPayload(draft: Draft) {
  return {
    projectId: draft.projectId,
    name: draft.name,
    dueDate: draft.dueDate || undefined,
    assigneeId: draft.assigneeId === NO_ASSIGNEE ? null : draft.assigneeId,
    description: draft.description,
    images: draft.images,
    driveLink: draft.driveLink,
    formatTagIds: draft.formatTagIds,
    channelTagIds: draft.channelTagIds,
    categoryTagIds: draft.categoryTagIds,
    status: draft.status,
  };
}

export function TaskModal({
  task,
  projects,
  members,
  formatTags,
  channelTags,
  categoryTags = [],
  statusColors,
  defaultProjectId,
  canEdit = true,
  currentUserId,
  onClose,
  onSaved,
  onDeleted,
  onDuplicated,
  onTagCreated,
}: {
  task: Task | null;
  projects: Project[];
  members: Member[];
  formatTags: Tag[];
  channelTags: Tag[];
  categoryTags?: Tag[];
  statusColors: StatusColor[];
  defaultProjectId: string;
  canEdit?: boolean;
  currentUserId: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted: (id: string) => void;
  onDuplicated: (task: Task) => void;
  onTagCreated: (tag: Tag) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromTask(task, defaultProjectId, currentUserId));
  const [liveTaskId, setLiveTaskId] = useState(task?.id);
  const [statusHistory, setStatusHistory] = useState(task?.statusHistory ?? []);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(task?.comments || []);
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [editingLink, setEditingLink] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  // Refs (não state) pra evitar corrida entre o autosave debounced e uma
  // criação/atualização ainda em andamento — persist() sempre lê o valor
  // atual daqui, nunca um closure velho.
  const liveTaskIdRef = useRef(task?.id);
  const inFlightRef = useRef(false);
  const pendingRef = useRef<Draft | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.name]);

  const isEditing = Boolean(liveTaskId);
  const dateLocked = isEditing && isOverdue(draft.dueDate, draft.status);
  const colorByStatus = useMemo(() => new Map(statusColors.map((entry) => [entry.status, entry.color])), [statusColors]);

  // Salva de verdade — cria a tarefa no primeiro autosave com nome+projeto
  // preenchidos, atualiza dali em diante. Se uma chamada já estiver em voo
  // quando outra edição chega, guarda só a mais recente pra rodar assim que
  // a primeira terminar (nunca perde uma edição, nunca dispara 2 ao mesmo
  // tempo).
  async function persist(current: Draft) {
    if (!current.name.trim() || !current.projectId || current.projectId === NO_PROJECT) return;
    if (!canEdit) return;
    if (inFlightRef.current) {
      pendingRef.current = current;
      return;
    }
    inFlightRef.current = true;
    setSaveState("saving");
    try {
      const isCreate = !liveTaskIdRef.current;
      const response = await fetch(isCreate ? "/api/tasks" : `/api/tasks/${liveTaskIdRef.current}`, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(current)),
      });
      const result = await response.json();
      if (!response.ok) {
        setSaveState("error");
        setError(result.error || "Não foi possível salvar.");
        return;
      }
      setError("");
      if (isCreate) {
        liveTaskIdRef.current = result.task.id;
        setLiveTaskId(result.task.id);
      }
      setStatusHistory(result.task.statusHistory);
      setSaveState("saved");
      onSaved(result.task);
    } catch {
      setSaveState("error");
      setError("Falha de conexão — tente de novo.");
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current) {
        const next = pendingRef.current;
        pendingRef.current = null;
        persist(next);
      }
    }
  }

  // `immediate`: pra escolhas discretas (select, data, tags) — salva na hora.
  // Sem isso: debounce, pra não disparar um PATCH a cada tecla digitada.
  function updateField<K extends keyof Draft>(key: K, value: Draft[K], options?: { immediate?: boolean }) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (options?.immediate) {
      persist(next);
    } else {
      debounceRef.current = setTimeout(() => persist(next), AUTOSAVE_DEBOUNCE_MS);
    }
  }

  function catalogFor(kind: TagKind): Tag[] {
    if (kind === "formato") return formatTags;
    if (kind === "categoria") return categoryTags;
    return channelTags;
  }

  const isPlanItem = Boolean(task?.planId);

  async function copyLink() {
    if (!liveTaskId) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/tarefas/${liveTaskId}`);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar o link.");
    }
  }

  async function remove() {
    if (!liveTaskId) return;
    if (!(await confirm({ title: "Excluir tarefa", message: `Excluir a tarefa "${draft.name}"? Essa ação não pode ser desfeita.`, confirmLabel: "Excluir", danger: true }))) return;
    const response = await fetch(`/api/tasks/${liveTaskId}`, { method: "DELETE" });
    if (!response.ok) return setError("Não foi possível excluir a tarefa.");
    onDeleted(liveTaskId);
  }

  async function duplicate() {
    if (!liveTaskId || isDuplicating) return;
    setIsDuplicating(true);
    const response = await fetch(`/api/tasks/${liveTaskId}/duplicate`, { method: "POST" });
    const result = await response.json();
    setIsDuplicating(false);
    if (!response.ok) return setError(result.error || "Não foi possível duplicar a tarefa.");
    onDuplicated(result.task);
  }

  async function addImageFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setIsUploadingImage(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const resized = await resizeImageFile(file);
        const formData = new FormData();
        formData.append("file", resized);
        const response = await fetch("/api/uploads", { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Falha ao enviar imagem.");
        updateField("images", [...draft.images, result.url], { immediate: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  function removeImage(url: string) {
    updateField("images", draft.images.filter((item) => item !== url), { immediate: true });
  }

  async function sendComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!liveTaskId || !commentText.trim()) return;
    setIsSendingComment(true);
    // O usuário está logado — assina o comentário com o nome dele, sem pedir.
    const author = members.find((member) => member.id === currentUserId)?.name || "Equipe";
    const response = await fetch(`/api/tasks/${liveTaskId}/comments`, {
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
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-[920px] w-[calc(100%-2rem)] max-h-[min(860px,calc(100vh-3rem))] flex flex-col gap-0 overflow-hidden p-0" showCloseButton>
        <DialogHeader className="modal-head task-modal-head">
          <DialogTitle className="sr-only">{draft.name || (isEditing ? "Editar tarefa" : "Nova tarefa")}</DialogTitle>
          <textarea
            ref={titleRef}
            className="meta-title-input"
            value={draft.name}
            onChange={(e) => updateField("name", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Nome da tarefa"
            rows={1}
            required
            maxLength={140}
          />
          {canEdit ? (
            <span className="task-save-status" aria-live="polite">
              {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : saveState === "error" ? "Erro ao salvar" : ""}
            </span>
          ) : null}
          {isEditing ? (
            <button type="button" className="icon-button" onClick={copyLink} title="Copiar link da tarefa" aria-label="Copiar link da tarefa">
              {linkCopied ? <Check size={14} /> : <Share2 size={14} />}
            </button>
          ) : null}
        </DialogHeader>
        <div className="modal-body">
          {error ? <div className="form-message">{error}</div> : null}
          <div className="task-modal-split">
            <div className="task-modal-pane-meta meta-rows">
              <MetaRow icon={<Folder size={13} />} label="Projeto">
                <Select items={projectLabels} value={draft.projectId || NO_PROJECT} onValueChange={(value) => updateField("projectId", value ?? NO_PROJECT, { immediate: true })}>
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
                <Select items={assigneeLabels} value={draft.assigneeId} onValueChange={(value) => updateField("assigneeId", value ?? NO_ASSIGNEE, { immediate: true })}>
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

              <TaskStatusControl
                status={draft.status}
                statusHistory={statusHistory}
                dueDate={draft.dueDate}
                color={colorByStatus.get(draft.status)}
                onChange={(value) => updateField("status", value, { immediate: true })}
              />

              <MetaRow icon={<CalendarDays size={13} />} label="Entrega">
                <input
                  className="meta-date"
                  type="date"
                  value={draft.dueDate}
                  disabled={dateLocked}
                  onChange={(e) => updateField("dueDate", e.target.value, { immediate: true })}
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
                onChange={(ids) => updateField("formatTagIds", ids, { immediate: true })}
                onCatalogUpdate={onTagCreated}
              />
              <TagPicker
                kind="canal"
                label="Canal"
                catalog={catalogFor("canal")}
                selectedIds={draft.channelTagIds}
                onChange={(ids) => updateField("channelTagIds", ids, { immediate: true })}
                onCatalogUpdate={onTagCreated}
              />

              <MetaRow icon={<Link2 size={13} />} label="Link (Drive)">
                {editingLink ? (
                  <input
                    className="meta-inline-input"
                    autoFocus
                    type="url"
                    value={draft.driveLink}
                    onChange={(e) => updateField("driveLink", e.target.value)}
                    onBlur={() => {
                      setEditingLink(false);
                      updateField("driveLink", draft.driveLink, { immediate: true });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setEditingLink(false);
                        updateField("driveLink", draft.driveLink, { immediate: true });
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

              {isPlanItem ? (
                <TagPicker
                  kind="categoria"
                  label="Categoria"
                  catalog={catalogFor("categoria")}
                  selectedIds={draft.categoryTagIds}
                  onChange={(ids) => updateField("categoryTagIds", ids, { immediate: true })}
                  onCatalogUpdate={onTagCreated}
                />
              ) : null}
            </div>

            <div className="task-modal-pane-desc">
              <div className="task-desc-head">
                <span className="meta-row-label task-desc-label"><AlignLeft size={13} /> Descrição</span>
                {canEdit ? (
                  <button
                    type="button"
                    className="task-desc-image-add"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploadingImage}
                    title="Adicionar imagem"
                  >
                    {isUploadingImage ? <Loader2 size={13} className="ai-spin" /> : <ImagePlus size={13} />} Imagem
                  </button>
                ) : null}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={(e) => {
                    addImageFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              {draft.images.length ? (
                <div className="task-desc-images">
                  {draft.images.map((url) => (
                    <div className="task-desc-image" key={url}>
                      <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Imagem da tarefa" /></a>
                      {canEdit ? (
                        <button type="button" onClick={() => removeImage(url)} aria-label="Remover imagem"><X size={11} /></button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {editingDescription ? (
                <textarea
                  autoFocus
                  className="task-desc-textarea"
                  value={draft.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  onBlur={() => setEditingDescription(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setEditingDescription(false);
                    }
                  }}
                  placeholder={isPlanItem ? "Direcionamento, roteiro, referência, legenda — escreva tudo aqui, do jeito que fizer sentido." : "Descreva o briefing da tarefa"}
                  maxLength={4000}
                />
              ) : (
                <button type="button" className="task-desc-display" onClick={() => setEditingDescription(true)}>
                  {draft.description ? renderDescription(draft.description) : <span className="meta-empty">Vazio — clique para escrever a descrição</span>}
                </button>
              )}
            </div>
          </div>

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
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="danger-button" onClick={remove}><Trash2 size={13} /> Excluir</button>
              <button type="button" className="secondary-button" onClick={duplicate} disabled={isDuplicating}>
                <Copy size={13} /> {isDuplicating ? "Duplicando..." : "Duplicar"}
              </button>
            </div>
          ) : <span />}
          <button type="button" className="secondary-button" onClick={onClose}>Fechar</button>
        </footer>
      </DialogContent>
    </Dialog>
    {ConfirmDialog}
    </>
  );
}
