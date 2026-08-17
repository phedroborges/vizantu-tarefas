"use client";

import { CalendarDays, Check, Folder, Radio, Shapes, User } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TagPickerPopover } from "@/components/tag-picker";
import { formatDueDate, todayIso } from "@/lib/dates";
import { STATUS_GROUPS, TASK_STATUSES } from "@/lib/types";
import type { Member, Project, StatusColor, Tag, Task, TaskStatus } from "@/lib/types";

// Criação rápida: nome e descrição no centro, todo o resto como pílulas
// compactas embaixo — nada de linha rotulada por campo. Cada pílula mostra o
// rótulo quando vazia e o valor quando preenchida, então dá pra criar só com
// o nome (Enter) ou detalhar sem sair do mesmo lugar.
export function QuickTaskModal({
  projects,
  members,
  formatTags,
  channelTags,
  statusColors,
  defaultProjectId,
  currentUserId,
  onClose,
  onCreated,
  onTagCreated,
}: {
  projects: Project[];
  members: Member[];
  formatTags: Tag[];
  channelTags: Tag[];
  statusColors: StatusColor[];
  defaultProjectId: string;
  currentUserId: string;
  onClose: () => void;
  onCreated: (task: Task) => void;
  onTagCreated: (tag: Tag) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || projects[0]?.id || "");
  const [assigneeId, setAssigneeId] = useState(currentUserId || "");
  const [status, setStatus] = useState<TaskStatus>("rascunho");
  const [dueDate, setDueDate] = useState(todayIso());
  const [formatTagIds, setFormatTagIds] = useState<string[]>([]);
  const [channelTagIds, setChannelTagIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLTextAreaElement>(null);

  const colorByStatus = useMemo(() => new Map(statusColors.map((s) => [s.status, s.color])), [statusColors]);
  const project = projects.find((p) => p.id === projectId);
  const assignee = members.find((m) => m.id === assigneeId);
  const statusMeta = TASK_STATUSES.find((s) => s.value === status);
  const activeMembers = members.filter((m) => m.active);

  async function create() {
    if (!name.trim()) return setError("Informe o nome da tarefa.");
    if (!projectId) return setError("Selecione um projeto.");
    setError("");
    setIsSaving(true);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        name,
        description,
        assigneeId: assigneeId || undefined,
        status,
        dueDate: dueDate || undefined,
        formatTagIds,
        channelTagIds,
      }),
    });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) return setError(result.error || "Não foi possível criar a tarefa.");
    onCreated(result.task);
  }

  // Enter cria (é o caminho de 90% dos casos); Shift+Enter quebra linha na
  // descrição; Cmd/Ctrl+Enter cria de qualquer campo.
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      create();
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-[600px] w-[calc(100%-2rem)] p-0 gap-0 overflow-hidden" showCloseButton onKeyDown={onKeyDown}>
        <DialogTitle className="sr-only">Nova tarefa</DialogTitle>

        <div className="qt-head">
          <Popover>
            <PopoverTrigger className="qt-chip qt-chip-project">
              <Folder size={12} /> {project?.name || "Selecionar projeto"}
            </PopoverTrigger>
            <PopoverContent className="!w-56 !rounded-none !p-0" align="start">
              <div className="tag-popover-list">
                {projects.map((p) => (
                  <button key={p.id} type="button" className={`tag-popover-row ${p.id === projectId ? "selected" : ""}`} onClick={() => setProjectId(p.id)}>
                    {p.name}
                    {p.id === projectId ? <Check size={13} /> : null}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="qt-body">
          <textarea
            ref={nameRef}
            autoFocus
            className="qt-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                create();
              }
            }}
            placeholder="Nome da tarefa"
            rows={1}
            maxLength={140}
          />
          <textarea
            className="qt-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Escreva uma descrição (opcional)"
            rows={3}
            maxLength={4000}
          />
          {error ? <div className="form-message" style={{ marginTop: 10 }}>{error}</div> : null}
        </div>

        <div className="qt-chips">
          {/* Status */}
          <Popover>
            <PopoverTrigger className="qt-chip qt-chip-status" style={{ "--status-color": colorByStatus.get(status) } as React.CSSProperties}>
              <span className="qt-dot" /> {statusMeta?.label}
            </PopoverTrigger>
            <PopoverContent className="!w-56 !rounded-none !p-0" align="start">
              <div className="tag-popover-list qt-status-list">
                {STATUS_GROUPS.map((group) => (
                  <div key={group.value}>
                    <span className="status-color-group-label">{group.label}</span>
                    {TASK_STATUSES.filter((s) => s.group === group.value).map((s) => (
                      <button key={s.value} type="button" className={`tag-popover-row ${s.value === status ? "selected" : ""}`} onClick={() => setStatus(s.value)}>
                        {s.label}
                        {s.value === status ? <Check size={13} /> : null}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Responsável */}
          <Popover>
            <PopoverTrigger className={`qt-chip ${assignee ? "filled" : ""}`}>
              <User size={12} /> {assignee?.name || "Responsável"}
            </PopoverTrigger>
            <PopoverContent className="!w-56 !rounded-none !p-0" align="start">
              <div className="tag-popover-list">
                <button type="button" className={`tag-popover-row ${!assigneeId ? "selected" : ""}`} onClick={() => setAssigneeId("")}>
                  Sem responsável
                  {!assigneeId ? <Check size={13} /> : null}
                </button>
                {activeMembers.map((m) => (
                  <button key={m.id} type="button" className={`tag-popover-row ${m.id === assigneeId ? "selected" : ""}`} onClick={() => setAssigneeId(m.id)}>
                    {m.name}
                    {m.id === assigneeId ? <Check size={13} /> : null}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Prazo */}
          <label className={`qt-chip qt-chip-date ${dueDate ? "filled" : ""}`}>
            <CalendarDays size={12} />
            {dueDate ? formatDueDate(dueDate) : "Prazo"}
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>

          {/* Formato */}
          <TagPickerPopover
            kind="formato"
            catalog={formatTags}
            selectedIds={formatTagIds}
            onChange={setFormatTagIds}
            onCatalogUpdate={onTagCreated}
            triggerClassName={`qt-chip ${formatTagIds.length ? "filled" : ""}`}
            trigger={
              <>
                <Shapes size={12} />
                {formatTagIds.length ? formatTags.filter((t) => formatTagIds.includes(t.id)).map((t) => t.label).join(", ") : "Formato"}
              </>
            }
          />

          {/* Canal */}
          <TagPickerPopover
            kind="canal"
            catalog={channelTags}
            selectedIds={channelTagIds}
            onChange={setChannelTagIds}
            onCatalogUpdate={onTagCreated}
            triggerClassName={`qt-chip ${channelTagIds.length ? "filled" : ""}`}
            trigger={
              <>
                <Radio size={12} />
                {channelTagIds.length ? channelTags.filter((t) => channelTagIds.includes(t.id)).map((t) => t.label).join(", ") : "Canal"}
              </>
            }
          />
        </div>

        <footer className="qt-footer">
          <span className="qt-hint">Enter para criar · Esc para fechar</span>
          <button type="button" className="primary-button" onClick={create} disabled={isSaving || !name.trim()}>
            {isSaving ? "Criando..." : "Criar tarefa"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
