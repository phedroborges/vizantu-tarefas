"use client";

import { ArrowLeft, ArrowRight, CalendarDays, CheckSquare, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  currentMonthKey,
  daysInCalendarMonth,
  isOverdue,
  overdueDays,
  monthKeyFromDate,
  monthLabel,
  moveMonth,
  todayIso,
} from "@/lib/dates";
import { responseError } from "@/lib/request-error";
import { useSetPageDetail } from "@/lib/page-context";
import { STATUS_GROUPS, TASK_COLUMNS, TASK_LIST_KINDS, TASK_STATUSES } from "@/lib/types";
import type { Member, Project, StatusColor, Tag, Task, TaskColumnKey, TaskListKind, TaskStatus } from "@/lib/types";
import { TaskModal } from "@/components/task-modal";
import { QuickTaskModal } from "@/components/quick-task-modal";
import { TagPickerPopover } from "@/components/tag-picker";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePreferences } from "@/lib/use-preferences";
import { migrateLocalPreferences } from "@/lib/migrate-local-preferences";
import { toggleColumn as toggleColumnKey, type MemberPreferences } from "@/lib/preferences";
import type { DateFormatKey } from "@/lib/date-format";
import { StatusTag } from "@/components/status-tag";
import { DueDateValue } from "@/components/due-date-value";
import { Avatar, AvatarName } from "@/components/avatar";
import { celebrateFrom } from "@/lib/celebrate";
import { TaskToolbar } from "@/components/task-toolbar";
import { useArrastoDeColuna } from "@/components/vz/use-resize";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const NO_ASSIGNEE = "none";
// Base UI's <Select.Value> só resolve o rótulo se o Root receber esse mapa.
const STATUS_LABELS: Record<string, string> = Object.fromEntries(TASK_STATUSES.map((status) => [status.value, status.label]));
const LIST_LABELS: Record<TaskListKind, string> = Object.fromEntries(TASK_LIST_KINDS.map((kind) => [kind.value, kind.label])) as Record<TaskListKind, string>;

// Cor do badge = grupo (3 cores + atrasada) — mais legível que 12 tons distintos.
function statusOf(task: Task): string {
  if (isOverdue(task.dueDate, task.status)) return "atrasada";
  return TASK_STATUSES.find((status) => status.value === task.status)?.group || "nao_iniciada";
}

function statusLabel(task: Task): string {
  return TASK_STATUSES.find((status) => status.value === task.status)?.label || task.status;
}

// Prazo com o atraso anexado — o atraso é fato da DATA, e é assim que ele
// chega ao assistente também.
function dueLabel(task: Task): string {
  if (!task.dueDate) return "sem prazo";
  return isOverdue(task.dueDate, task.status) ? `${task.dueDate} (atrasada)` : task.dueDate;
}

// Filtro = status exato (dos 12) ou "atrasada" — mais preciso que filtrar só por grupo.
function statusFilterValue(task: Task): string {
  return isOverdue(task.dueDate, task.status) ? "atrasada" : task.status;
}

function InlineStatusCell({ task, colorByStatus, onChange }: { task: Task; colorByStatus: Map<TaskStatus, string>; onChange: (status: TaskStatus, origin?: HTMLElement | null) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Select items={STATUS_LABELS} value={task.status} onValueChange={(value) => value && onChange(value as TaskStatus, triggerRef.current)}>
      <SelectTrigger ref={triggerRef} className="meta-trigger cell-trigger status-trigger" onClick={(event) => event.stopPropagation()}>
        <StatusTag status={task.status} colorByStatus={colorByStatus} />
      </SelectTrigger>
      <SelectContent>
        {STATUS_GROUPS.map((statusGroup) => (
          <SelectGroup key={statusGroup.value}>
            <SelectLabel>{statusGroup.label}</SelectLabel>
            {TASK_STATUSES.filter((item) => item.group === statusGroup.value).map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function InlineAssigneeCell({ task, members, onChange }: { task: Task; members: Member[]; onChange: (assigneeId: string | null) => void }) {
  const activeMembers = members.filter((member) => member.active);
  const currentInactive =
    task.assigneeId && !activeMembers.some((member) => member.id === task.assigneeId)
      ? members.find((member) => member.id === task.assigneeId)
      : undefined;
  const labels: Record<string, string> = {
    [NO_ASSIGNEE]: "Sem responsável",
    ...Object.fromEntries(activeMembers.map((member) => [member.id, member.name])),
    ...(currentInactive ? { [currentInactive.id]: `${currentInactive.name} (inativo)` } : {}),
  };
  const current = task.assigneeId ? members.find((member) => member.id === task.assigneeId) : undefined;
  return (
    <Select items={labels} value={task.assigneeId || NO_ASSIGNEE} onValueChange={(value) => onChange(value === NO_ASSIGNEE ? null : value ?? null)}>
      <SelectTrigger className="meta-trigger cell-trigger" onClick={(event) => event.stopPropagation()}>
        {current ? <AvatarName name={current.name} imageUrl={current.avatarUrl} /> : <SelectValue placeholder="Sem responsável" />}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_ASSIGNEE}>Sem responsável</SelectItem>
        {activeMembers.map((member) => (
          <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
        ))}
        {currentInactive ? <SelectItem value={currentInactive.id}>{currentInactive.name} (inativo)</SelectItem> : null}
      </SelectContent>
    </Select>
  );
}

function InlineDueDateCell({ task, locked, dateFormat, onChange, onLockedClick }: { task: Task; locked: boolean; dateFormat: DateFormatKey; onChange: (value: string) => void; onLockedClick: () => void }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        type="date"
        className="cell-date-input"
        defaultValue={task.dueDate || ""}
        autoFocus
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          setEditing(false);
          onChange(event.target.value);
        }}
        onBlur={() => setEditing(false)}
      />
    );
  }

  return (
    <button
      type="button"
      className={`meta-value-trigger cell-trigger ${locked ? "locked" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        if (locked) return onLockedClick();
        setEditing(true);
      }}
    >
      <DueDateValue dueDate={task.dueDate} status={task.status} dateFormat={dateFormat} />
    </button>
  );
}

// Largura de partida de cada coluna. Só entra em jogo enquanto a pessoa não
// arrastou nada — a partir daí vale o que ela escolheu.
const LARGURA_PADRAO: Record<string, number> = {
  name: 330,
  formatTags: 150,
  channelTags: 140,
  categoryTags: 140,
  assignee: 190,
  dueDate: 130,
  status: 200,
  lists: 150,
  driveLink: 150,
};

// Duplo clique na divisória devolve a largura padrão daquela coluna — o mesmo
// gesto de planilha, que é onde as pessoas aprenderam isto.
function semColuna(larguras: Record<string, number>, chave: string): Record<string, number> {
  const copia = { ...larguras };
  delete copia[chave];
  return copia;
}

export function TarefasView({
  initialTasks,
  initialProjects,
  initialMembers,
  initialFormatTags,
  initialChannelTags,
  initialStatusColors,
  initialPreferences,
  hasSavedPreferences = false,
  canEdit = true,
  canEditStatusColors = false,
  currentUserId,
  initialTaskId,
}: {
  initialTasks: Task[];
  initialProjects: Project[];
  initialMembers: Member[];
  initialFormatTags: Tag[];
  initialChannelTags: Tag[];
  initialStatusColors: StatusColor[];
  initialPreferences: MemberPreferences;
  hasSavedPreferences?: boolean;
  canEdit?: boolean;
  canEditStatusColors?: boolean;
  currentUserId: string;
  initialTaskId?: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [formatTags, setFormatTags] = useState(initialFormatTags);
  const [channelTags, setChannelTags] = useState(initialChannelTags);
  const [statusColors, setStatusColors] = useState(initialStatusColors);

  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [listFilter, setListFilter] = useState<TaskListKind | "">("");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const withDue = initialTasks.filter((task) => task.dueDate).map((task) => monthKeyFromDate(task.dueDate!));
    return withDue.sort().at(-1) || currentMonthKey();
  });
  const [selectedTask, setSelectedTask] = useState<Task | "new" | null>(
    () => initialTasks.find((task) => task.id === initialTaskId) ?? null,
  );
  const [toast, setToast] = useState("");
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  // Jeito de ver: da pessoa, guardado na conta (ver lib/preferences.ts). As
  // cores dos status NÃO entram aqui — são padrão do time.
  const { preferences, update: updatePreferences, replace: replacePreferences } = usePreferences(initialPreferences);

  // Virada de uma vez só: recolhe o que sobrou do localStorage das versões
  // antigas, salva na conta e limpa o navegador. Ver migrate-local-preferences.
  useEffect(() => {
    let active = true;
    void migrateLocalPreferences(hasSavedPreferences).then((migrated) => {
      if (active && migrated) replacePreferences(migrated);
    });
    return () => { active = false; };
  }, [hasSavedPreferences, replacePreferences]);
  const { taskView: view, taskColumns: visibleColumns, taskColumnWidths, dateFormat, showFinalized } = preferences;

  // Largura de coluna: o título da tarefa NUNCA quebra em duas linhas — ele
  // trunca — e quem precisa de mais espaço arrasta a divisória do cabeçalho.
  // A largura fica salva nas preferências da pessoa, não no navegador.
  const [larguraEmCurso, setLarguraEmCurso] = useState<Record<string, number> | null>(null);
  const larguras = larguraEmCurso ?? (taskColumnWidths as Record<string, number>);
  const { arrastando, iniciar: iniciarArrasto } = useArrastoDeColuna({
    larguras,
    onLargura: (chave, largura) => setLarguraEmCurso((atual) => ({ ...(atual ?? taskColumnWidths as Record<string, number>), [chave]: largura })),
    onFim: (finais) => {
      setLarguraEmCurso(null);
      updatePreferences({ taskColumnWidths: finais });
    },
  });
  function larguraDe(chave: string) {
    return larguras[chave] ?? LARGURA_PADRAO[chave] ?? 140;
  }
  const setView = (next: MemberPreferences["taskView"]) => updatePreferences({ taskView: next });
  const setShowFinalized = (next: boolean) => updatePreferences({ showFinalized: next });
  const setDateFormat = (next: MemberPreferences["dateFormat"]) => updatePreferences({ dateFormat: next });
  const toggleColumn = (key: MemberPreferences["taskColumns"][number]) =>
    updatePreferences({ taskColumns: toggleColumnKey(visibleColumns, key) });

  const projectById = useMemo(() => new Map(initialProjects.map((project) => [project.id, project])), [initialProjects]);
  const memberById = useMemo(() => new Map(initialMembers.map((member) => [member.id, member])), [initialMembers]);
  const formatTagById = useMemo(() => new Map(formatTags.map((tag) => [tag.id, tag])), [formatTags]);
  const channelTagById = useMemo(() => new Map(channelTags.map((tag) => [tag.id, tag])), [channelTags]);
  const activeMembers = useMemo(() => initialMembers.filter((member) => member.active), [initialMembers]);
  const colorByStatus = useMemo(() => new Map(statusColors.map((entry) => [entry.status, entry.color])), [statusColors]);

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks.filter((task) => {
      // Finalizada não tem mais nada a acompanhar — some da lista, a menos que
      // o usuário peça pra ver ("Mostrar finalizadas") ou filtre por esse status direto.
      if (task.status === "finalizado" && !showFinalized && statusFilter !== "finalizado") return false;
      if (projectFilter && task.projectId !== projectFilter) return false;
      if (assigneeFilter && task.assigneeId !== assigneeFilter) return false;
      if (statusFilter && statusFilterValue(task) !== statusFilter) return false;
      if (listFilter && !task.lists.includes(listFilter)) return false;
      if (normalized) {
        const assigneeName = task.assigneeId ? memberById.get(task.assigneeId)?.name || "" : "";
        const channelNames = task.channelTagIds.map((id) => channelTagById.get(id)?.label || "").join(" ");
        if (!`${task.name} ${channelNames} ${assigneeName}`.toLowerCase().includes(normalized)) return false;
      }
      return true;
    });
  }, [tasks, query, projectFilter, assigneeFilter, statusFilter, listFilter, showFinalized, memberById, channelTagById]);

  // A tarefa aberta no modal nunca some da lista por baixo dele. Trocar o
  // status ou o responsável dentro do modal faz a tarefa deixar de casar com
  // o filtro ativo, e ao fechar o modal ela teria sumido — a pessoa acha que
  // perdeu a tarefa. Enquanto o modal está aberto, ela fica visível.
  // Atrasadas vão pro topo, da mais atrasada pra menos, independente de
  // qualquer outra ordem — é o que precisa de ação antes de tudo. O resto
  // mantém a ordem que já vinha.
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const atrasoA = overdueDays(a.dueDate, a.status);
      const atrasoB = overdueDays(b.dueDate, b.status);
      if (atrasoA !== atrasoB) return atrasoB - atrasoA;
      return 0;
    });
  }, [filteredTasks]);

  const visibleTasks = useMemo(() => {
    if (!selectedTask || selectedTask === "new") return sortedTasks;
    if (sortedTasks.some((task) => task.id === selectedTask.id)) return sortedTasks;
    const pinned = tasks.find((task) => task.id === selectedTask.id);
    return pinned ? [pinned, ...sortedTasks] : sortedTasks;
  }, [sortedTasks, selectedTask, tasks]);

  const pageDetail = useMemo(() => {
    if (selectedTask && selectedTask !== "new") {
      const project = projectById.get(selectedTask.projectId);
      const assignee = selectedTask.assigneeId ? memberById.get(selectedTask.assigneeId)?.name : null;
      return `O usuário está com o modal de edição aberto na tarefa "${selectedTask.name}" (projeto ${project?.name || "sem projeto"}, responsável ${assignee || "sem responsável"}, status ${statusLabel(selectedTask)}, prazo ${dueLabel(selectedTask)}). Se a pergunta for curta ou usar "essa tarefa"/"ela"/"aqui", é sobre essa tarefa.`;
    }
    if (selectedTask === "new") {
      return "O usuário está com o modal de criação de uma nova tarefa aberto, ainda sem nome definido.";
    }
    const filterParts: string[] = [];
    if (projectFilter) filterParts.push(`projeto ${projectById.get(projectFilter)?.name || projectFilter}`);
    if (assigneeFilter) filterParts.push(`responsável ${memberById.get(assigneeFilter)?.name || assigneeFilter}`);
    if (statusFilter) filterParts.push(`status ${statusFilter}`);
    const filterText = filterParts.length ? ` filtrada por ${filterParts.join(", ")}` : "";
    return `O usuário está vendo a lista de tarefas${filterText}, na visão de ${view === "lista" ? "lista" : "calendário"}.`;
  }, [selectedTask, projectFilter, assigneeFilter, statusFilter, view, projectById, memberById]);
  useSetPageDetail(pageDetail);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  // Link direto pra uma tarefa (/tarefas/[id]) que não existe ou que o usuário
  // não tem acesso — avisa e volta pra lista, sem quebrar a página.
  useEffect(() => {
    if (!initialTaskId || initialTasks.some((task) => task.id === initialTaskId)) return;
    const timer = window.setTimeout(() => showToast("Tarefa não encontrada ou sem acesso a ela."), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantém a URL da tarefa aberta em sincronia (sem navegação do Next — só a
  // barra de endereço) pra dar um link direto e copiável pra cada tarefa.
  useEffect(() => {
    const path = selectedTask && selectedTask !== "new" ? `/tarefas/${selectedTask.id}` : selectedTask === "new" ? null : "/tarefas";
    if (path && window.location.pathname !== path) window.history.replaceState(null, "", path);
  }, [selectedTask]);

  // O TaskModal salva sozinho (autosave com debounce), então isto roda a cada
  // pausa na digitação — NÃO pode fechar o modal nem soltar toast, senão a
  // tarefa some da tela no meio da edição. O próprio modal já mostra
  // "salvando/salvo". Só a criação pelo modal rápido fecha (ver handleCreated).
  function handleSaved(task: Task) {
    setTasks((current) => {
      const exists = current.some((item) => item.id === task.id);
      return exists ? current.map((item) => (item.id === task.id ? task : item)) : [task, ...current];
    });
    // Mantém o modal apontando pra versão recém-salva (status, prazo e listas
    // podem ter mudado do lado do servidor).
    setSelectedTask((current) => (current && current !== "new" && current.id === task.id ? task : current));
  }

  function handleCreated(task: Task) {
    setTasks((current) => (current.some((item) => item.id === task.id) ? current : [task, ...current]));
    setSelectedTask(null);
    showToast("Tarefa criada.");
  }

  function handleDeleted(id: string) {
    setTasks((current) => current.filter((item) => item.id !== id));
    setSelectedTask(null);
    showToast("Tarefa excluída.");
  }

  function handleDuplicated(task: Task) {
    setTasks((current) => [task, ...current]);
    setSelectedTask(null);
    showToast("Tarefa duplicada.");
  }

  async function patchTask(taskId: string, payload: Record<string, unknown>, origin?: HTMLElement | null) {
    const anterior = tasks.find((item) => item.id === taskId)?.status;
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return showToast(await responseError(response, "salvar a alteração"));
    const result = await response.json();
    setTasks((current) => current.map((item) => (item.id === taskId ? result.task : item)));
    // Entrou em "Para aprovação" agora (e não já estava lá): a demanda saiu da
    // mão do time. Mesmo confete que o cliente vê ao aprovar.
    if (result.task.status === "para_aprovacao" && anterior !== "para_aprovacao") {
      celebrateFrom(origin);
      showToast("Enviada para aprovação!");
    }
  }

  async function quickAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = quickAddTitle.trim();
    const projectId = projectFilter || initialProjects[0]?.id;
    if (!name || !projectId || isQuickAdding) return;
    setIsQuickAdding(true);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectId }),
    });
    setIsQuickAdding(false);
    if (!response.ok) return showToast(await responseError(response, "criar a tarefa"));
    const created = (await response.json()).task;
    setTasks((current) => [created, ...current]);
    setQuickAddTitle("");
  }

  function handleTagCreated(tag: Tag) {
    if (tag.kind === "formato") setFormatTags((current) => [...current, tag]);
    else setChannelTags((current) => [...current, tag]);
  }

  const monthTasks = useMemo(
    () => visibleTasks.filter((task) => task.dueDate && monthKeyFromDate(task.dueDate) === selectedMonth),
    [visibleTasks, selectedMonth],
  );
  const tasksByDay = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    monthTasks.forEach((task) => {
      grouped.set(task.dueDate!, [...(grouped.get(task.dueDate!) || []), task]);
    });
    return grouped;
  }, [monthTasks]);
  const noDueTasks = useMemo(() => visibleTasks.filter((task) => !task.dueDate), [visibleTasks]);
  const calendarDays = useMemo(() => daysInCalendarMonth(selectedMonth), [selectedMonth]);

  function renderColumn(key: TaskColumnKey, task: Task) {
    switch (key) {
      case "formatTags":
        return task.formatTagIds.length
          ? task.formatTagIds.map((id) => <span className="badge format" key={id}>{formatTagById.get(id)?.label}</span>)
          : "—";
      case "channelTags":
        return task.channelTagIds.length
          ? task.channelTagIds.map((id) => <span className="badge channel" key={id}>{channelTagById.get(id)?.label}</span>)
          : "—";
      case "assignee": {
        const member = task.assigneeId ? memberById.get(task.assigneeId) : undefined;
        return member ? <AvatarName name={member.name} imageUrl={member.avatarUrl} /> : "—";
      }
      case "dueDate":
        return <DueDateValue dueDate={task.dueDate} status={task.status} dateFormat={dateFormat} />;
      case "status":
        return <StatusTag status={task.status} colorByStatus={colorByStatus} />;
      case "lists":
        return task.lists.length ? task.lists.map((kind) => <span className="badge list" key={kind}>{LIST_LABELS[kind]}</span>) : "—";
      case "driveLink":
        return task.driveLink ? (
          <a href={task.driveLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            Abrir
          </a>
        ) : "—";
      default:
        return null;
    }
  }

  // Colunas editáveis direto na lista, sem abrir o modal — só quando o usuário
  // tem permissão de edição; visualizadores continuam vendo o valor puro.
  function renderEditableColumn(key: TaskColumnKey, task: Task) {
    if (!canEdit) return renderColumn(key, task);
    switch (key) {
      case "formatTags":
        return (
          <TagPickerPopover
            kind="formato"
            catalog={formatTags}
            selectedIds={task.formatTagIds}
            onChange={(ids) => patchTask(task.id, { formatTagIds: ids })}
            onCatalogUpdate={handleTagCreated}
            triggerClassName="cell-trigger"
            trigger={
              task.formatTagIds.length
                ? task.formatTagIds.map((id) => <span className="badge format" key={id}>{formatTagById.get(id)?.label}</span>)
                : <span className="meta-empty">—</span>
            }
          />
        );
      case "channelTags":
        return (
          <TagPickerPopover
            kind="canal"
            catalog={channelTags}
            selectedIds={task.channelTagIds}
            onChange={(ids) => patchTask(task.id, { channelTagIds: ids })}
            onCatalogUpdate={handleTagCreated}
            triggerClassName="cell-trigger"
            trigger={
              task.channelTagIds.length
                ? task.channelTagIds.map((id) => <span className="badge channel" key={id}>{channelTagById.get(id)?.label}</span>)
                : <span className="meta-empty">—</span>
            }
          />
        );
      case "assignee":
        return (
          <InlineAssigneeCell
            task={task}
            members={initialMembers}
            onChange={(assigneeId) => patchTask(task.id, { assigneeId })}
          />
        );
      case "dueDate":
        return (
          <InlineDueDateCell
            task={task}
            locked={isOverdue(task.dueDate, task.status)}
            dateFormat={dateFormat}
            onChange={(dueDate) => patchTask(task.id, { dueDate })}
            onLockedClick={() => showToast('Tarefa atrasada — mude o status para "Aprovado", "Problema" ou "Finalizado" para editar a data.')}
          />
        );
      case "status":
        return (
          <InlineStatusCell
            task={task}
            colorByStatus={colorByStatus}
            onChange={(status, origin) => patchTask(task.id, { status }, origin)}
          />
        );
      default:
        return renderColumn(key, task);
    }
  }

  return (
    <>
      <main className="admin-page dashboard">
        <div className="dashboard-head calendar-heading">
          <div>
            <span className="eyebrow">Operação</span>
            <h1>Tarefas</h1>
            <p>Acompanhe todas as demandas do time em uma lista única ou pelo calendário de entregas.</p>
          </div>
          {canEdit ? (
            <button className="primary-button" type="button" onClick={() => setSelectedTask("new")}>
              <Plus size={16} /> Nova tarefa
            </button>
          ) : null}
        </div>

        <section className="panel">
          <TaskToolbar
            filters={{ query, projectId: projectFilter, assigneeId: assigneeFilter, status: statusFilter, list: listFilter, showFinalized }}
            onFiltersChange={(next) => {
              if (next.query !== undefined) setQuery(next.query);
              if (next.projectId !== undefined) setProjectFilter(next.projectId);
              if (next.assigneeId !== undefined) setAssigneeFilter(next.assigneeId);
              if (next.status !== undefined) setStatusFilter(next.status);
              if (next.list !== undefined) setListFilter(next.list);
              if (next.showFinalized !== undefined) setShowFinalized(next.showFinalized);
            }}
            projects={initialProjects}
            members={activeMembers}
            view={view}
            onViewChange={setView}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
            dateFormat={dateFormat}
            onDateFormatChange={setDateFormat}
            statusColors={statusColors}
            onStatusColorsSaved={(colors) => {
              setStatusColors(colors);
              showToast("Cores dos status atualizadas.");
            }}
            canEditStatusColors={canEditStatusColors}
          />

          {view === "lista" ? (
            <>
              {visibleTasks.length ? (
                <div className="project-table-wrap">
                  <table className="task-table vz-table--fixed">
                    <thead>
                      <tr>
                        <th style={{ width: larguraDe("name") }}>
                          Tarefa
                          <button
                            type="button"
                            className="vz-table__resizer"
                            data-dragging={arrastando === "name"}
                            aria-label="Redimensionar a coluna Tarefa"
                            onPointerDown={(evento) => iniciarArrasto(evento, "name", larguraDe("name"), 200)}
                            onDoubleClick={() => updatePreferences({ taskColumnWidths: semColuna(taskColumnWidths, "name") })}
                          />
                        </th>
                        {TASK_COLUMNS.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                          <th key={column.key} style={{ width: larguraDe(column.key) }}>
                            {column.label}
                            <button
                              type="button"
                              className="vz-table__resizer"
                              data-dragging={arrastando === column.key}
                              aria-label={`Redimensionar a coluna ${column.label}`}
                              onPointerDown={(evento) => iniciarArrasto(evento, column.key, larguraDe(column.key))}
                              onDoubleClick={() => updatePreferences({ taskColumnWidths: semColuna(taskColumnWidths, column.key) })}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTasks.map((task) => (
                        <tr key={task.id} className={isOverdue(task.dueDate, task.status) ? "is-overdue" : ""}>
                          <td className="task-name-cell" onClick={() => setSelectedTask(task)}>
                            <span className="task-name">{task.name}</span>
                            <span className="task-project">
                              {(() => {
                                const project = projectById.get(task.projectId);
                                if (!project) return "Sem projeto";
                                return <><Avatar name={project.name} imageUrl={project.avatarUrl} color={project.avatarColor} size={15} />{project.name}</>;
                              })()}
                            </span>
                          </td>
                          {TASK_COLUMNS.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                            <td key={column.key}>{renderEditableColumn(column.key, task)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <CheckSquare size={35} />
                  <h3>Nenhuma tarefa encontrada</h3>
                  <p>Ajuste os filtros ou crie a primeira tarefa deste projeto.</p>
                </div>
              )}
              {canEdit ? (
                <form className="task-quick-add" onSubmit={quickAdd}>
                  <Plus size={14} color="var(--muted-text)" />
                  <input
                    value={quickAddTitle}
                    onChange={(e) => setQuickAddTitle(e.target.value)}
                    placeholder="Adicionar tarefa rápida e apertar Enter..."
                    maxLength={140}
                    disabled={isQuickAdding}
                  />
                </form>
              ) : null}
            </>
          ) : (
            <>
              <div className="calendar-summary">
                <div className="calendar-filter">
                  <button type="button" onClick={() => setSelectedMonth((current) => moveMonth(current, -1))} aria-label="Mês anterior"><ArrowLeft size={16} /></button>
                  <input type="month" value={selectedMonth} onChange={(e) => e.target.value && setSelectedMonth(e.target.value)} />
                  <button type="button" onClick={() => setSelectedMonth((current) => moveMonth(current, 1))} aria-label="Próximo mês"><ArrowRight size={16} /></button>
                </div>
                <strong style={{ textTransform: "capitalize" }}>{monthLabel(selectedMonth)}</strong>
                <span>{monthTasks.length} {monthTasks.length === 1 ? "tarefa" : "tarefas"}</span>
              </div>
              <div className="calendar-scroll">
                <div className="calendar-grid" aria-label={`Calendário de ${monthLabel(selectedMonth)}`}>
                  {WEEKDAYS.map((weekday) => <span className="calendar-weekday" key={weekday}>{weekday}</span>)}
                  {calendarDays.map((day, index) => {
                    if (day === null) return <span className="calendar-day empty" key={`empty-${index}`} aria-hidden="true" />;
                    const key = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                    const dayTasks = tasksByDay.get(key) || [];
                    const isToday = key === todayIso();
                    return (
                      <div className={`calendar-day ${dayTasks.length ? "has-tasks" : ""} ${isToday ? "today" : ""}`} key={key}>
                        <div className="calendar-date"><span>{day}</span>{dayTasks.length ? <small>{dayTasks.length}</small> : null}</div>
                        <div className="calendar-cards">
                          {dayTasks.map((task) => (
                            <button className={`task-card ${statusOf(task)}`} type="button" onClick={() => setSelectedTask(task)} key={task.id}>
                              <span>{projectById.get(task.projectId)?.name || "Sem projeto"}</span>
                              <strong>{task.name}</strong>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {!monthTasks.length ? (
                <div className="calendar-empty"><CalendarDays size={28} /><strong>Nenhuma tarefa neste mês</strong><p>Use as setas ou o filtro para consultar outro período.</p></div>
              ) : null}
              {noDueTasks.length ? (
                <div style={{ padding: "16px 20px", borderTop: "1px solid var(--line)" }}>
                  <span className="eyebrow" style={{ marginBottom: 10 }}>Sem data de entrega</span>
                  <ul className="upcoming-list" style={{ border: "1px solid var(--line)" }}>
                    {noDueTasks.map((task) => (
                      <li className="upcoming-item" key={task.id} onClick={() => setSelectedTask(task)} style={{ cursor: "pointer" }}>
                        <div><strong>{task.name}</strong><span>{projectById.get(task.projectId)?.name || "Sem projeto"}</span></div>
                        <StatusTag status={task.status} colorByStatus={colorByStatus} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>
      </main>
      {/* Criar = modal enxuto (nome/descrição + pílulas). Abrir uma tarefa
          existente = modal completo, com comentários e tempo por status. */}
      {selectedTask === "new" ? (
        <QuickTaskModal
          projects={initialProjects}
          members={initialMembers}
          formatTags={formatTags}
          channelTags={channelTags}
          statusColors={statusColors}
          defaultProjectId={projectFilter || initialProjects[0]?.id || ""}
          currentUserId={currentUserId}
          onClose={() => setSelectedTask(null)}
          onCreated={handleCreated}
          onTagCreated={handleTagCreated}
        />
      ) : null}
      {selectedTask && selectedTask !== "new" ? (
        <TaskModal
          task={selectedTask}
          projects={initialProjects}
          members={initialMembers}
          formatTags={formatTags}
          channelTags={channelTags}
          statusColors={statusColors}
          defaultProjectId={projectFilter || initialProjects[0]?.id || ""}
          canEdit={canEdit}
          currentUserId={currentUserId}
          onClose={() => setSelectedTask(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onDuplicated={handleDuplicated}
          onTagCreated={handleTagCreated}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
