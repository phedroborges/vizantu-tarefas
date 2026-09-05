"use client";

import Link from "next/link";
import { CalendarDays, Clock3, LayoutGrid, List, ListTodo } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, EmptyState, Segmented, Tag } from "@/components/vz";
import { TASK_STATUSES, type StatusGroup, type Task } from "@/lib/types";
import { currentMonthKey, daysInCalendarMonth, monthKeyFromDate, monthLabel, moveMonth, todayIso } from "@/lib/dates";
import { MonthCalendar, MonthCalendarDay, MonthCalendarGrid, MonthCalendarHeader, MonthCalendarWeekdays } from "@/components/vz/month-calendar";
import { ColunaHeader, useColunasRedimensionaveis, type ColunaDef } from "@/components/vz/table";

const tableColumns: ColunaDef[] = [
  { key: "task", label: "Tarefa", largura: 360, min: 180 },
  { key: "due", label: "Prazo", largura: 130, min: 95 },
  { key: "stage", label: "Etapa", largura: 170, min: 120 },
  { key: "list", label: "Lista", largura: 210, min: 110 },
];

const groups: { key: StatusGroup; label: string; tone: "slate" | "amber" | "green" }[] = [
  { key: "nao_iniciada", label: "Não iniciadas", tone: "slate" },
  { key: "em_andamento", label: "Em andamento", tone: "amber" },
  { key: "feita", label: "Feitas", tone: "green" },
];
const groupOf = (task: Task) => TASK_STATUSES.find((item) => item.value === task.status)?.group || "nao_iniciada";
const statusLabel = (task: Task) => TASK_STATUSES.find((item) => item.value === task.status)?.label || task.status;
const dateLabel = (date?: string) => date ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) : "Sem prazo";

export function ProjectTaskHub({ tasks }: { tasks: Task[] }) {
  const [view, setView] = useState<"lista" | "calendario" | "board">("lista");
  const [month, setMonth] = useState(() => tasks.find((task) => task.dueDate)?.dueDate ? monthKeyFromDate(tasks.find((task) => task.dueDate)!.dueDate!) : currentMonthKey());
  const columns = useColunasRedimensionaveis("project-task-hub", tableColumns);
  const sorted = useMemo(() => tasks.toSorted((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")), [tasks]);
  const byDate = useMemo(() => {
    const result = new Map<string, Task[]>();
    for (const task of sorted) {
      const key = task.dueDate || "sem-data";
      result.set(key, [...(result.get(key) || []), task]);
    }
    return result;
  }, [sorted]);

  return <Card className="project-hub">
    <div className="project-hub__head"><div><span className="vz-eyebrow">Operação do cliente</span><h2 className="vz-h2">Todas as entregas</h2><p className="vz-caption">Os mesmos dados em três formas de acompanhar.</p></div><Segmented value={view} onChange={setView} options={[{ value: "lista", label: "Lista", icon: <List size={14} /> }, { value: "calendario", label: "Calendário", icon: <CalendarDays size={14} /> }, { value: "board", label: "Board", icon: <LayoutGrid size={14} /> }]} /></div>
    {tasks.length ? <div className="project-task-chart" aria-label="Distribuição das tarefas por etapa">{groups.map((group) => { const count = tasks.filter((task) => groupOf(task) === group.key).length; return <div key={group.key}><span>{group.label}</span><div><i className={`is-${group.key}`} style={{ width: `${count / tasks.length * 100}%` }} /></div><b>{count}</b></div>; })}</div> : null}
    {!tasks.length ? <EmptyState icon={<ListTodo size={24} />} title="Nenhuma tarefa neste projeto" description="As tarefas criadas para este cliente aparecerão aqui automaticamente." /> : null}
    {tasks.length && view === "lista" ? <div className="vz-table-wrap"><table className="vz-table vz-table--fixed project-hub__table"><thead><tr>{tableColumns.map((column) => <ColunaHeader key={column.key} coluna={column} largura={columns.larguras[column.key]} arrastando={columns.arrastando === column.key} onArrastar={columns.iniciarArrasto} onRedefinir={columns.redefinir} />)}</tr></thead><tbody>{sorted.map((task) => <tr key={task.id}><td><Link className="vz-table__primary" href={`/tarefas/${task.id}`}>{task.name}</Link><span className="vz-table__sub">Atualizada em {dateLabel(task.updatedAt.slice(0, 10))}</span></td><td>{dateLabel(task.dueDate)}</td><td><Tag tone={groups.find((item) => item.key === groupOf(task))?.tone}>{statusLabel(task)}</Tag></td><td>{task.lists.length ? task.lists.join(" · ") : "—"}</td></tr>)}</tbody></table></div> : null}
    {tasks.length && view === "board" ? <div className="project-board">{groups.map((group) => { const items = sorted.filter((task) => groupOf(task) === group.key); return <section key={group.key} className="project-board__column"><header><span><i className={`vz-dot vz-dot--${group.tone}`} />{group.label}</span><b>{items.length}</b></header><div>{items.map((task) => <Link href={`/tarefas/${task.id}`} key={task.id} className="project-board__card"><strong>{task.name}</strong><span><Clock3 size={12} /> {dateLabel(task.dueDate)}</span><Tag tone={group.tone}>{statusLabel(task)}</Tag></Link>)}</div></section>; })}</div> : null}
    {tasks.length && view === "calendario" ? <MonthCalendar className="project-month-calendar"><MonthCalendarHeader label={monthLabel(month)} onPrevious={() => setMonth((value) => moveMonth(value, -1))} onNext={() => setMonth((value) => moveMonth(value, 1))} /><MonthCalendarGrid><MonthCalendarWeekdays />{daysInCalendarMonth(month).map((day, index) => { if (!day) return <MonthCalendarDay day={null} key={`empty-${index}`} />; const iso = `${month}-${String(day).padStart(2, "0")}`; const items = byDate.get(iso) || []; return <MonthCalendarDay day={day} today={iso === todayIso()} hasItems={Boolean(items.length)} key={iso}><div className="vz-calendar__events">{items.map((task) => <Link className="vz-calendar__event" href={`/tarefas/${task.id}`} key={task.id}><span>{task.name}</span></Link>)}</div></MonthCalendarDay>; })}</MonthCalendarGrid></MonthCalendar> : null}
  </Card>;
}
