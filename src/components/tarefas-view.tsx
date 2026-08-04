"use client";

import { ArrowLeft, ArrowRight, CalendarDays, CheckSquare, List, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  currentMonthKey,
  daysInCalendarMonth,
  formatDueDate,
  isOverdue,
  monthKeyFromDate,
  monthLabel,
  moveMonth,
} from "@/lib/dates";
import { useSetPageDetail } from "@/lib/page-context";
import { STATUS_GROUPS, TASK_COLUMNS, TASK_STATUSES } from "@/lib/types";
import type { Member, Project, Tag, Task, TaskColumnKey } from "@/lib/types";
import { TaskModal } from "@/components/task-modal";
import { TaskColumnPicker } from "@/components/task-column-picker";
import { useTaskColumns } from "@/lib/use-task-columns";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Cor do badge = grupo (3 cores + atrasada) — mais legível que 12 tons distintos.
function statusOf(task: Task): string {
  if (isOverdue(task.dueDate, task.status)) return "atrasada";
  return TASK_STATUSES.find((status) => status.value === task.status)?.group || "nao_iniciada";
}

function statusLabel(task: Task): string {
  if (isOverdue(task.dueDate, task.status)) return "Atrasada";
  return TASK_STATUSES.find((status) => status.value === task.status)?.label || task.status;
}

// Filtro = status exato (dos 12) ou "atrasada" — mais preciso que filtrar só por grupo.
function statusFilterValue(task: Task): string {
  return isOverdue(task.dueDate, task.status) ? "atrasada" : task.status;
}

export function TarefasView({
  initialTasks,
  initialProjects,
  initialMembers,
  initialFormatTags,
  initialChannelTags,
  canEdit = true,
}: {
  initialTasks: Task[];
  initialProjects: Project[];
  initialMembers: Member[];
  initialFormatTags: Tag[];
  initialChannelTags: Tag[];
  canEdit?: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [formatTags, setFormatTags] = useState(initialFormatTags);
  const [channelTags, setChannelTags] = useState(initialChannelTags);
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const withDue = initialTasks.filter((task) => task.dueDate).map((task) => monthKeyFromDate(task.dueDate!));
    return withDue.sort().at(-1) || currentMonthKey();
  });
  const [selectedTask, setSelectedTask] = useState<Task | "new" | null>(null);
  const [toast, setToast] = useState("");
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const { visible: visibleColumns, toggle: toggleColumn } = useTaskColumns();

  const projectById = useMemo(() => new Map(initialProjects.map((project) => [project.id, project])), [initialProjects]);
  const memberById = useMemo(() => new Map(initialMembers.map((member) => [member.id, member])), [initialMembers]);
  const formatTagById = useMemo(() => new Map(formatTags.map((tag) => [tag.id, tag])), [formatTags]);
  const channelTagById = useMemo(() => new Map(channelTags.map((tag) => [tag.id, tag])), [channelTags]);
  const activeMembers = useMemo(() => initialMembers.filter((member) => member.active), [initialMembers]);

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (projectFilter && task.projectId !== projectFilter) return false;
      if (assigneeFilter && task.assigneeId !== assigneeFilter) return false;
      if (statusFilter && statusFilterValue(task) !== statusFilter) return false;
      if (normalized) {
        const assigneeName = task.assigneeId ? memberById.get(task.assigneeId)?.name || "" : "";
        const channelNames = task.channelTagIds.map((id) => channelTagById.get(id)?.label || "").join(" ");
        if (!`${task.name} ${channelNames} ${assigneeName}`.toLowerCase().includes(normalized)) return false;
      }
      return true;
    });
  }, [tasks, query, projectFilter, assigneeFilter, statusFilter, memberById, channelTagById]);

  const pageDetail = useMemo(() => {
    if (selectedTask && selectedTask !== "new") {
      const project = projectById.get(selectedTask.projectId);
      const assignee = selectedTask.assigneeId ? memberById.get(selectedTask.assigneeId)?.name : null;
      return `O usuário está com o modal de edição aberto na tarefa "${selectedTask.name}" (projeto ${project?.name || "sem projeto"}, responsável ${assignee || "sem responsável"}, status ${statusLabel(selectedTask)}, prazo ${selectedTask.dueDate || "sem prazo"}). Se a pergunta for curta ou usar "essa tarefa"/"ela"/"aqui", é sobre essa tarefa.`;
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

  function handleSaved(task: Task) {
    setTasks((current) => {
      const exists = current.some((item) => item.id === task.id);
      return exists ? current.map((item) => (item.id === task.id ? task : item)) : [task, ...current];
    });
    setSelectedTask(null);
    showToast("Tarefa salva.");
  }

  function handleDeleted(id: string) {
    setTasks((current) => current.filter((item) => item.id !== id));
    setSelectedTask(null);
    showToast("Tarefa excluída.");
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
    const result = await response.json();
    setIsQuickAdding(false);
    if (!response.ok) return showToast(result.error || "Não foi possível criar a tarefa.");
    setTasks((current) => [result.task, ...current]);
    setQuickAddTitle("");
  }

  function handleTagCreated(tag: Tag) {
    if (tag.kind === "formato") setFormatTags((current) => [...current, tag]);
    else setChannelTags((current) => [...current, tag]);
  }

  const monthTasks = useMemo(
    () => filteredTasks.filter((task) => task.dueDate && monthKeyFromDate(task.dueDate) === selectedMonth),
    [filteredTasks, selectedMonth],
  );
  const tasksByDay = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    monthTasks.forEach((task) => {
      grouped.set(task.dueDate!, [...(grouped.get(task.dueDate!) || []), task]);
    });
    return grouped;
  }, [monthTasks]);
  const noDueTasks = useMemo(() => filteredTasks.filter((task) => !task.dueDate), [filteredTasks]);
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
      case "assignee":
        return task.assigneeId ? memberById.get(task.assigneeId)?.name || "—" : "—";
      case "dueDate":
        return formatDueDate(task.dueDate);
      case "status":
        return <span className={`status ${statusOf(task)}`}>{statusLabel(task)}</span>;
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
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por tarefa, canal ou responsável" aria-label="Buscar tarefas" />
            </div>
            <div className="toolbar-filters">
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} aria-label="Filtrar por projeto">
                <option value="">Todos os projetos</option>
                {initialProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
              </select>
              <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} aria-label="Filtrar por responsável">
                <option value="">Todos os responsáveis</option>
                {activeMembers.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por status">
                <option value="">Todos os status</option>
                {STATUS_GROUPS.map((group) => (
                  <optgroup label={group.label} key={group.value}>
                    {TASK_STATUSES.filter((status) => status.group === group.value).map((status) => (
                      <option value={status.value} key={status.value}>{status.label}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="atrasada">Atrasada</option>
              </select>
              {view === "lista" ? <TaskColumnPicker visible={visibleColumns} onToggle={toggleColumn} /> : null}
              <div className="view-toggle" role="tablist" aria-label="Alternar visualização">
                <button type="button" role="tab" aria-selected={view === "lista"} className={view === "lista" ? "active" : ""} onClick={() => setView("lista")}><List size={14} /> Lista</button>
                <button type="button" role="tab" aria-selected={view === "calendario"} className={view === "calendario" ? "active" : ""} onClick={() => setView("calendario")}><CalendarDays size={14} /> Calendário</button>
              </div>
            </div>
          </div>

          {view === "lista" ? (
            <>
              {filteredTasks.length ? (
                <div className="project-table-wrap">
                  <table className="task-table">
                    <thead>
                      <tr>
                        <th>Tarefa</th>
                        {TASK_COLUMNS.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                          <th key={column.key}>{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => (
                        <tr key={task.id} onClick={() => setSelectedTask(task)}>
                          <td>
                            <span className="task-name">{task.name}</span>
                            <span className="task-project">{projectById.get(task.projectId)?.name || "Sem projeto"}</span>
                          </td>
                          {TASK_COLUMNS.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                            <td key={column.key}>{renderColumn(column.key, task)}</td>
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
                    return (
                      <div className={`calendar-day ${dayTasks.length ? "has-tasks" : ""}`} key={key}>
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
                        <span className={`status ${statusOf(task)}`}>{statusLabel(task)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>
      </main>
      {selectedTask ? (
        <TaskModal
          task={selectedTask === "new" ? null : selectedTask}
          projects={initialProjects}
          members={initialMembers}
          formatTags={formatTags}
          channelTags={channelTags}
          defaultProjectId={projectFilter || initialProjects[0]?.id || ""}
          canEdit={canEdit}
          onClose={() => setSelectedTask(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onTagCreated={handleTagCreated}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
