"use client";
import { ClientPlansMenu } from "./client-plans-menu";

import { AlertTriangle, ChevronRight, ClipboardList, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button, Tag } from "@/components/vz";

import { currentMonthKey } from "@/lib/dates";
import { isPlanClosed, monthlyPlanTitle } from "@/lib/plan-month";
import { queueSummary } from "@/lib/plan-queue";
import { networkError } from "@/lib/request-error";
import { PLAN_KINDS } from "@/lib/types";
import type { Plan, PlanKind, Project, Task, UserRole } from "@/lib/types";

type PlanosViewProps = {
  projects: Project[];
  initialPlans: Plan[];
  initialTasks: Task[];
  /** Cliente aberto. Sem ele, a tela é a escolha de cliente. */
  selectedProjectId?: string;
  currentUserId: string;
  currentUserRole: UserRole;
  canPlan: boolean;
  today: string;
};

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function PlanosView(props: PlanosViewProps) {
  const { projects, selectedProjectId } = props;
  const plans = props.initialPlans;
  const [tasks, setTasks] = useState(props.initialTasks);
  const selected = projects.find((project) => project.id === selectedProjectId);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const router = useRouter();
  return selected ? <>
    <ClientPlansMenu project={selected} plans={plans} tasks={tasks} setTasks={setTasks} today={props.today} canPlan={props.canPlan} onNewPlan={() => setNewPlanOpen(true)} />
    {newPlanOpen ? <NewPlanDialog project={selected} onClose={() => setNewPlanOpen(false)} onCreated={plan => router.push(`/planos/${plan.id}`)} /> : null}
  </> : <ClientPicker {...props} plans={plans} tasks={tasks} />;
}

// ---------- Escolha do cliente ----------
// A porta de entrada. Cada cartão responde, antes do clique, "tem coisa minha
// aqui?" — o número grande é o que está na mão de quem cria.
function ClientPicker({ projects, plans, tasks, today, currentUserId, currentUserRole }: PlanosViewProps & { plans: Plan[]; tasks: Task[] }) {
  const [query, setQuery] = useState("");
  const creative = currentUserRole === "diretor_criativo";
  const clients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return projects
      .filter((project) => !normalized || project.name.toLocaleLowerCase("pt-BR").includes(normalized))
      .map((project) => {
        const own = tasks.filter((task) => task.projectId === project.id && !plans.some(p => p.id === task.planId && isPlanClosed(p, today.slice(0, 7))));
        return {
          project,
          summary: queueSummary(own, today),
          mine: queueSummary(own.filter((task) => task.assigneeId === currentUserId), today).toCreate,
          plans: plans.filter((plan) => plan.projectId === project.id).length,
        };
      })
      .sort((a, b) => b.summary.late - a.summary.late || b.summary.toCreate - a.summary.toCreate || b.summary.open - a.summary.open || a.project.name.localeCompare(b.project.name, "pt-BR"));
  }, [projects, plans, tasks, today, query, currentUserId]);

  return (
    <main className="admin-page dashboard plan-screen pq-page">
      <div className="vz-pagehead">
        <div className="vz-pagehead__text">
          <span className="vz-eyebrow">Operação</span>
          <h1 className="vz-h1">Planos</h1>
          <p className="vz-caption">Escolha um cliente e depois o plano que deseja acompanhar.</p>
        </div>
        <div className="vz-pagehead__actions">
          <div className="vz-plan-search pq-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente…" aria-label="Buscar cliente" /></div>
        </div>
      </div>

      {clients.length ? (
        <div className="pq-clients">
          {clients.map(({ project, summary, mine, plans: planCount }) => (
            <Link key={project.id} href={`/planos?cliente=${project.id}`} className={`vz-card vz-card--interactive pq-client${summary.open ? "" : " is-idle"}`}>
              <div className="pq-client__head">
                <strong>{project.name}</strong>
                {summary.late ? <Tag tone="red" icon={<AlertTriangle size={11} />}>{plural(summary.late, "atrasada", "atrasadas")}</Tag> : null}
              </div>
              <div className="pq-client__number">
                <b>{summary.toCreate}</b>
                <span>para criar{creative && summary.toCreate ? ` · ${mine} com você` : ""}</span>
              </div>
              <div className="pq-client__foot">
                <span>{plural(summary.open, "demanda aberta", "demandas abertas")} · {plural(planCount, "plano", "planos")}</span>
                <ChevronRight size={15} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="vz-empty"><span className="vz-empty__icon"><ClipboardList size={22} /></span><h3>{query ? "Nenhum cliente encontrado" : "Nenhum cliente disponível"}</h3><p>{query ? "Tente buscar por outro nome." : "Você ainda não está na equipe de nenhum cliente."}</p></div>
      )}
    </main>
  );
}

function NewPlanDialog({ project, onClose, onCreated }: { project: Project; onClose: () => void; onCreated: (plan: Plan) => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<PlanKind>("content");
  // Os meses já existem. Criar um plano começa por uma campanha com nome próprio.
  const [monthly, setMonthly] = useState(false);
  const [month, setMonth] = useState(() => currentMonthKey());
  const isMonthly = kind === "content" && monthly;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isMonthly && !month) return setError("Escolha o mês do plano.");
    if (!isMonthly && !title.trim()) return setError("Informe o título do plano.");
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: isMonthly ? monthlyPlanTitle(project.name, month) : title, projectId: project.id, kind, periodMonth: isMonthly ? month : undefined }) });
      const result = await response.json();
      if (!response.ok) return setError(result.error || "Não foi possível criar o plano.");
      onCreated(result.plan);
    } catch {
      setError(networkError("criar o plano"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" type="button" aria-label="Fechar criação de plano" onClick={onClose} />
      <form className="vz-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-plan-title">
        <div className="vz-modal__head">
          <div><span className="vz-eyebrow">{project.name}</span><h2 className="vz-h2" id="new-plan-title">Novo plano</h2></div>
          <button type="button" className="vz-icon-btn vz-icon-btn--sm" onClick={onClose} aria-label="Fechar"><X size={15} /></button>
        </div>
        <div className="vz-modal__body pq-form">
          {error ? <div className="form-message" role="alert">{error}</div> : null}
          <label className="vz-field"><span className="vz-label">Tipo</span>
            <select className="vz-select" value={kind} onChange={(event) => setKind(event.target.value as PlanKind)}>
              {PLAN_KINDS.filter((item) => item.value !== "brand").map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
            <span className="vz-hint">Os conteúdos e pacotes você adiciona dentro do plano.</span>
          </label>
          {kind === "content" ? (
            <label className="vz-field"><span className="vz-label">Plano</span>
              <select className="vz-select" value={monthly ? "mensal" : "campanha"} onChange={(event) => setMonthly(event.target.value === "mensal")}>
                <option value="mensal">Mensal — tarefas criadas no mês entram automaticamente</option>
                <option value="campanha">Campanha — entrega à parte, com nome próprio</option>
              </select>
            </label>
          ) : null}
          {isMonthly ? (
            <label className="vz-field"><span className="vz-label">Mês</span><input className="vz-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} required /><span className="vz-hint">O plano se chamará “{monthlyPlanTitle(project.name, month || "2026-01")}”. Toda tarefa criada neste mês entra nele, salvo escolha de outro plano.</span></label>
          ) : (
            <label className="vz-field"><span className="vz-label">Título do plano</span><input className="vz-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Campanha de Black Friday" maxLength={140} required autoFocus /></label>
          )}
        </div>
        <div className="vz-modal__foot"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary" disabled={saving}><Plus size={14} />{saving ? "Criando…" : "Criar plano"}</Button></div>
      </form>
    </div>
  );
}
