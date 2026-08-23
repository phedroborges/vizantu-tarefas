"use client";

import { CalendarDays, Check, Circle, ExternalLink, Link2, Palette } from "lucide-react";
import { useState } from "react";
import { TaskModal } from "@/components/task-modal";
import { formatDueDate } from "@/lib/dates";
import { TASK_STATUSES } from "@/lib/types";
import type { Member, Plan, Project, StatusColor, Tag, Task } from "@/lib/types";

const isComplete = (task: Task) => task.status === "finalizado" || task.status === "aprovado";
const statusLabel = (task: Task) => TASK_STATUSES.find((item) => item.value === task.status)?.label || task.status;

export function BrandDetailView({ plan, project, initialTasks, members, formatTags, channelTags, categoryTags, statusColors, currentUserId, canEdit }: { plan: Plan; project: Project; initialTasks: Task[]; members: Member[]; formatTags: Tag[]; channelTags: Tag[]; categoryTags: Tag[]; statusColors: StatusColor[]; currentUserId: string; canEdit: boolean }) {
  const [tasks, setTasks] = useState([...initialTasks].sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0)));
  const [editing, setEditing] = useState<Task | undefined>();
  const completed = tasks.filter(isComplete).length;
  const rate = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const memberById = new Map(members.map((member) => [member.id, member]));
  function saved(task: Task) { setTasks((current) => current.map((item) => item.id === task.id ? task : item)); setEditing(task); }

  return <>
    <main className="admin-page brand-detail-page">
      <header className="brand-hero"><div><span className="eyebrow">{project.name} · Marca</span><h1>{plan.title}</h1><p>Cada etapa é uma tarefa da operação. Abra uma etapa para definir responsável, prazo, orientações e o link do entregável.</p></div><div className="brand-progress-ring"><strong>{rate}%</strong><span>concluído</span></div></header>
      <div className="brand-progress"><i style={{ width: `${rate}%` }} /></div>
      <section className="brand-checklist-panel"><div className="brand-checklist-head"><div><Palette size={18} /><span><strong>Jornada da marca</strong><small>{completed} de {tasks.length} entregas concluídas</small></span></div></div>
        <ol className="brand-checklist">{tasks.map((task, index) => { const done = isComplete(task); const assignee = task.assigneeId ? memberById.get(task.assigneeId)?.name : undefined; return <li key={task.id} className={done ? "is-complete" : ""}>
          <button className="brand-stage-main" onClick={() => setEditing(task)}><span className="brand-stage-marker">{done ? <Check size={15} /> : <Circle size={15} />}</span><span className="brand-stage-number">{String(index + 1).padStart(2, "0")}</span><span className="brand-stage-copy"><strong>{task.name}</strong><small>{statusLabel(task)}{assignee ? ` · ${assignee}` : " · Sem responsável"}{task.dueDate ? ` · ${formatDueDate(task.dueDate)}` : ""}</small></span></button>
          <div className="brand-stage-actions">{task.dueDate ? <span><CalendarDays size={13} /> {formatDueDate(task.dueDate)}</span> : null}{task.driveLink ? <a href={task.driveLink} target="_blank" rel="noreferrer"><Link2 size={13} /> Entregável <ExternalLink size={11} /></a> : <button onClick={() => setEditing(task)}><Link2 size={13} /> Adicionar entregável</button>}</div>
        </li>})}</ol>
      </section>
    </main>
    {editing ? <TaskModal task={editing} projects={[project]} members={members} formatTags={formatTags} channelTags={channelTags} categoryTags={categoryTags} statusColors={statusColors} defaultProjectId={project.id} canEdit={canEdit} allowDeleteAndDuplicate={false} currentUserId={currentUserId} onClose={() => setEditing(undefined)} onSaved={saved} onDeleted={() => {}} onDuplicated={() => {}} onTagCreated={() => {}} /> : null}
  </>;
}
