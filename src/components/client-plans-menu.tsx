"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, AlertTriangle, ChevronRight } from "lucide-react";
import { Button, Card, Progress, Tag } from "@/components/vz";
import { moveMonth } from "@/lib/dates";
import { isPlanClosed, monthLabel, planDisplayName } from "@/lib/plan-month";
import { planProgress } from "@/lib/plan-queue";
import { networkError, responseError } from "@/lib/request-error";
import { CLOSED_TASK_STATUSES, type Plan, type Project, type Task } from "@/lib/types";

export function ClientPlansMenu({ project, plans, tasks, setTasks, canPlan, today, onNewPlan }: {
  project: Project; plans: Plan[]; tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  canPlan: boolean; today: string; onNewPlan: () => void;
}) {
  const [message, setMessage] = useState("");
  const [moving, setMoving] = useState(false);
  const month = today.slice(0, 7);
  const [monthFilter, setMonthFilter] = useState(month);
  const clientPlans = plans.filter(p => p.projectId === project.id).sort((a, b) => (a.periodMonth || "9999").localeCompare(b.periodMonth || "9999"));
  const current = clientPlans.filter(p => p.periodMonth === month && !isPlanClosed(p, month));
  const future = clientPlans.filter(p => p.periodMonth && p.periodMonth > month && !isPlanClosed(p, month));
  const campaigns = clientPlans.filter(p => !p.periodMonth && !isPlanClosed(p, month));
  const closed = clientPlans.filter(p => isPlanClosed(p, month));
  const clientTasks = tasks.filter(t => t.projectId === project.id);
  const pending = clientTasks.filter(t => !CLOSED_TASK_STATUSES.includes(t.status) && closed.some(p => p.id === t.planId));
  const currentPending = clientTasks.filter(t => !CLOSED_TASK_STATUSES.includes(t.status) && current.some(p => p.id === t.planId));
  const targets = [...current, ...future, ...campaigns].filter(p => p.kind === "content" || p.kind === "process");

  async function transfer(task: Task, planId: string) {
    if (!planId || moving) return;
    setMoving(true); setMessage("");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) });
      if (!response.ok) return setMessage(await responseError(response, "transferir a tarefa"));
      const result = await response.json();
      setTasks(all => all.map(t => t.id === task.id ? result.task : t));
      setMessage("Tarefa transferida. O histórico e o prazo foram preservados.");
    } catch { setMessage(networkError("transferir a tarefa")); }
    finally { setMoving(false); }
  }

  function planList(title: string, entries: Plan[]) {
    if (!entries.length) return null;
    return <Card className="pq-plans"><div className="vz-card__head"><h2 className="vz-h3">{title}</h2></div><ul className="pq-plan-list">
      {entries.map(plan => {
        const progress = planProgress(clientTasks.filter(t => t.planId === plan.id));
        return <li key={plan.id} className="pq-plan"><Link className="pq-plan__main" href={`/planos/${plan.id}`}>
          <strong>{planDisplayName(plan)}</strong><span>{progress.total} tarefas · {progress.done} finalizadas · {progress.open} {isPlanClosed(plan, month) ? "não finalizadas no encerramento" : "pendentes"}</span>
          <Progress value={progress.done} total={progress.total} thin />
        </Link><Tag outline>{isPlanClosed(plan, month) ? "Encerrado" : plan.periodMonth === month ? "Ativo neste mês" : plan.periodMonth ? "Planejado" : "Campanha / projeto"}</Tag><ChevronRight size={16} /></li>;
      })}
    </ul></Card>;
  }

  function pendingList(entries: Task[]) {
    return <ul className="pq-plan-list">{entries.map(task => <li className="pq-plan" key={task.id}><div className="pq-plan__main"><strong>{task.name}</strong><span>{clientPlans.find(p => p.id === task.planId)?.title}</span></div>
      {canPlan ? <select className="vz-select" aria-label={`Transferir ${task.name}`} value="" disabled={moving} onChange={e => transfer(task, e.target.value)}><option value="">Transferir para…</option>{targets.filter(p => p.id !== task.planId).map(p => <option key={p.id} value={p.id}>{planDisplayName(p)}</option>)}</select> : null}
    </li>)}</ul>;
  }

  return <main className="admin-page dashboard plan-screen pq-page">
    <div className="vz-pagehead"><div className="vz-pagehead__text">
      <Link href="/planos" className="vz-eyebrow pq-back"><ArrowLeft size={12} /> Clientes</Link>
      <h1 className="vz-h1">{project.name}</h1><p className="vz-caption">Escolha um plano. Os meses são criados automaticamente e encerrados na virada do mês.</p>
    </div>{canPlan ? <Button variant="primary" size="sm" onClick={onNewPlan}>Novo plano</Button> : null}</div>
    <div className="pq-period-selector">
      <label className="vz-field"><span className="vz-label">Mês do plano</span><select className="vz-select" aria-label="Mês do plano" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
        <option value="all">Todos os meses</option>
        {[...new Set(clientPlans.map(p => p.periodMonth).filter((m): m is string => Boolean(m)))].map(m => <option key={m} value={m}>{monthLabel(m)}{m === month ? " · Atual" : m < month ? " · Encerrado" : ""}</option>)}
        <option value="campaigns">Campanhas e outros planos</option>
      </select></label>
    </div>
    {message ? <p role="status" className="form-message">{message}</p> : null}
    {planList(monthFilter === "all" ? "Planos mensais" : monthFilter === "campaigns" ? "Campanhas e outros planos" : monthLabel(monthFilter), clientPlans.filter(p => monthFilter === "campaigns" ? !p.periodMonth : p.periodMonth && (monthFilter === "all" || p.periodMonth === monthFilter)))}
    {monthFilter !== "campaigns" && campaigns.length ? <Button variant="secondary" onClick={() => setMonthFilter("campaigns")}>Ver campanhas e outros planos ({campaigns.length})</Button> : null}
    {currentPending.length ? <Card className="pq-plans"><div className="vz-card__head"><div><h2 className="vz-h3">{currentPending.length} tarefas ainda precisam ser finalizadas</h2><p className="vz-caption">Ao terminar {monthLabel(month)}, elas saem da fila ativa. Transfira para {monthLabel(moveMonth(month, 1))} as que vão continuar.</p></div></div>
      {Number(today.slice(8, 10)) >= 25 ? pendingList(currentPending) : null}
    </Card> : null}
    {pending.length ? <Card className="pq-plans"><div className="vz-card__head"><div><h2 className="vz-h3"><AlertTriangle size={16} /> {pending.length} pendências de meses encerrados</h2><p className="vz-caption">Estão fora da aprovação e da fila ativa. Escolha um destino para retomar cada tarefa.</p></div></div>{pendingList(pending)}</Card> : null}
  </main>;
}
