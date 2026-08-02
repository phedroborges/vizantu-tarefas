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
import { TASK_FORMATS, TASK_STATUSES } from "@/lib/types";
import type { Project, Task } from "@/lib/types";
import { TaskModal } from "@/components/task-modal";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function statusOf(task: Task): string {
  return isOverdue(task.dueDate, task.status) ? "atrasada" : task.status;
}

function statusLabel(task: Task): string {
  if (isOverdue(task.dueDate, task.status)) return "Atrasada";
  return TASK_STATUSES.find((status) => status.value === task.status)?.label || task.status;
}

function formatLabel(task: Task): string {
  return TASK_FORMATS.find((format) => format.value === task.format)?.label || "";
}

export function TarefasView({ initialTasks, initialProjects }: { initialTasks: Task[]; initialProjects: Project[] }) {
  const [tasks, setTasks] = useState(initialTasks);
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

  const projectById = useMemo(() => new Map(initialProjects.map((project) => [project.id, project])), [initialProjects]);
  const assignees = useMemo(
    () => Array.from(new Set(tasks.map((task) => task.assignee).filter(Boolean))) as string[],
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (projectFilter && task.projectId !== projectFilter) return false;
      if (assigneeFilter && task.assignee !== assigneeFilter) return false;
      if (statusFilter && statusOf(task) !== statusFilter) return false;
      if (normalized && !`${task.name} ${task.channel || ""} ${task.assignee || ""}`.toLowerCase().includes(normalized)) return false;
      return true;
    });
  }, [tasks, query, projectFilter, assigneeFilter, statusFilter]);

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

  return (
    <>
      <main className="admin-page dashboard">
        <div className="dashboard-head calendar-heading">
          <div>
            <span className="eyebrow">Operação</span>
            <h1>Tarefas</h1>
            <p>Acompanhe todas as demandas do time em uma lista única ou pelo calendário de entregas.</p>
          </div>
          <button className="primary-button" type="button" onClick={() => setSelectedTask("new")}>
            <Plus size={16} /> Nova tarefa
          </button>
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
                {assignees.map((assignee) => <option value={assignee} key={assignee}>{assignee}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por status">
                <option value="">Todos os status</option>
                {TASK_STATUSES.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}
                <option value="atrasada">Atrasada</option>
              </select>
              <div className="view-toggle" role="tablist" aria-label="Alternar visualização">
                <button type="button" role="tab" aria-selected={view === "lista"} className={view === "lista" ? "active" : ""} onClick={() => setView("lista")}><List size={14} /> Lista</button>
                <button type="button" role="tab" aria-selected={view === "calendario"} className={view === "calendario" ? "active" : ""} onClick={() => setView("calendario")}><CalendarDays size={14} /> Calendário</button>
              </div>
            </div>
          </div>

          {view === "lista" ? (
            filteredTasks.length ? (
              <div className="project-table-wrap">
                <table className="task-table">
                  <thead>
                    <tr>
                      <th>Tarefa</th>
                      <th>Formato</th>
                      <th>Canal</th>
                      <th>Responsável</th>
                      <th>Prazo</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr key={task.id} onClick={() => setSelectedTask(task)}>
                        <td>
                          <span className="task-name">{task.name}</span>
                          <span className="task-project">{projectById.get(task.projectId)?.name || "Sem projeto"}</span>
                        </td>
                        <td>{task.format ? <span className="badge format">{formatLabel(task)}</span> : "—"}</td>
                        <td>{task.channel ? <span className="badge channel">{task.channel}</span> : "—"}</td>
                        <td>{task.assignee || "—"}</td>
                        <td>{formatDueDate(task.dueDate)}</td>
                        <td><span className={`status ${statusOf(task)}`}>{statusLabel(task)}</span></td>
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
            )
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
          defaultProjectId={projectFilter || initialProjects[0]?.id || ""}
          onClose={() => setSelectedTask(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
