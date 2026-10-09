"use client";

import { ArrowLeft, BadgeDollarSign, CheckCircle2, Eye, TrendingUp, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { PeriodBar, PeriodDelta } from "@/components/period-bar";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { formatDueDate, formatDuration } from "@/lib/dates";
import { brl } from "@/lib/finance/calculations";
import type { MemberFinanceLine, MemberFinanceProfile } from "@/lib/finance/member-profile";
import { TASK_STATUSES, USER_ROLES } from "@/lib/types";
import "@/app/financeiro/finance.css";

/** O tempo de trabalho da pessoa, medido pela fase em que ela atua. */
export type MemberPerformance = {
  area: "criacao" | "estrategia";
  averageMs?: number;
  samples: number;
  previousAverageMs?: number;
  openTasks: number;
};

type MemberFinanceViewProps = {
  profile: MemberFinanceProfile | null;
  period: DashboardPeriod;
  performance?: MemberPerformance;
  /** O período tem um período anterior para comparar. */
  compare: boolean;
  /** Só o dono recebe a lista: é ele quem troca de pessoa. */
  people?: { id: string; name: string }[];
};

const PAYMENT_LABEL = { demand: "Por demanda", salary: "Salário fixo", none: "Sem remuneração configurada" } as const;
const SITUATION: Record<MemberFinanceLine["situation"], { label: string; ok?: boolean }> = {
  lancada: { label: "Lançada", ok: true },
  a_lancar: { label: "A lançar" },
  salario: { label: "Salário fixo" },
  sem_valor: { label: "Sem valor" },
  cancelada: { label: "Cancelada" },
};

function Metric({ label, value, detail, accent = false, delta }: { label: string; value: string; detail: string; accent?: boolean; delta?: React.ReactNode }) {
  return <article className={`fin-metric${accent ? " is-accent" : ""}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small>{delta}</article>;
}

function MemberPicker({ people, selected }: { people: { id: string; name: string }[]; selected: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <label className="fin-member-picker"><span>Pessoa da equipe</span>
    <select value={selected} onChange={(event) => { const next = new URLSearchParams(searchParams); next.set("membro", event.target.value); router.push(`${pathname}?${next}`); }}>
      {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
    </select>
  </label>;
}

export function MemberFinanceView({ profile, period, performance, compare, people }: MemberFinanceViewProps) {
  if (!profile) {
    return <main className="fin-page"><div className="fin-empty">{people ? "Nenhum diretor criativo ou social media ativo para mostrar." : "Seu perfil financeiro ainda não está disponível."}</div></main>;
  }
  const { member, totals, previous } = profile;
  const role = USER_ROLES.find((item) => item.value === member.role)?.label ?? member.role;
  const salaried = profile.paymentMode === "salary";
  const priced = profile.lines.filter((line) => line.amount !== null).length;
  const maxHistory = Math.max(1, ...profile.history.map((row) => row.earnings));
  const attentionCount = profile.attention.reduce((sum, point) => sum + point.tasks.length, 0);
  const count = (value: number) => String(value);

  return <main className="fin-page">
    <header className="fin-heading">
      <div className="fin-member-head">
        <Avatar name={member.name} imageUrl={member.avatarUrl} size={52} />
        <div>
          <span className="fin-eyebrow"><Wallet size={13} /> {people ? "Financeiro da equipe" : "Meu financeiro"}</span>
          <h1>{member.name}</h1>
          <p>{role} · {PAYMENT_LABEL[profile.paymentMode]}{salaried ? ` de ${brl(profile.salary)} por mês` : ""}</p>
        </div>
      </div>
      {people ? <div className="fin-creative-actions"><Link className="fin-profile-link" href="/financeiro"><ArrowLeft size={12} /> Voltar ao financeiro</Link><MemberPicker people={people} selected={member.id} /></div> : null}
    </header>

    <PeriodBar key={`${period.preset}:${period.range?.from}:${period.range?.to}`} period={period} pastNote="Os pontos de atenção e as tarefas em andamento são sempre os de agora." />

    <section className="fin-metrics" aria-label="Resumo do período">
      {salaried
        ? <Metric accent label="Salário fixo mensal" value={brl(profile.salary)} detail="Não varia com a quantidade de demandas nem com o período" />
        : <Metric accent label="Ganhos no período" value={brl(totals.earnings)} detail={profile.paymentMode === "none" ? "Sem remuneração por demanda configurada" : "Demandas aprovadas ou finalizadas, pela tabela de valores"} delta={compare ? <PeriodDelta current={totals.earnings} previous={previous?.earnings} mode="percent" format={brl} /> : undefined} />}
      <Metric label="Demandas computadas" value={count(totals.deliveries)} detail="Aprovadas ou finalizadas no período" delta={compare ? <PeriodDelta current={totals.deliveries} previous={previous?.deliveries} mode="percent" format={count} /> : undefined} />
      {salaried
        ? <Metric label="Tarefas abertas" value={count(performance?.openTasks ?? profile.inProgress)} detail="Com a pessoa agora, em qualquer etapa" />
        : <Metric label="Ainda a lançar" value={brl(totals.pending)} detail={`Já lançado pelo financeiro: ${brl(totals.launched)}`} />}
      <Metric label="Em andamento agora" value={count(profile.inProgress)} detail="Só entram no financeiro depois de aprovadas" />
    </section>

    <section className="fin-metrics" aria-label="Ritmo de trabalho">
      <Metric
        label={performance?.area === "estrategia" ? "Tempo médio de estratégia por tarefa" : "Tempo médio de criação por entrega"}
        value={performance?.averageMs === undefined ? "Sem base" : formatDuration(performance.averageMs)}
        detail={performance?.samples ? `${performance.samples} ${performance.area === "estrategia" ? "tarefa(s) medida(s)" : "entrega(s) com ciclo fechado"}, sem contar a espera pelo cliente` : "Ainda não há ciclos fechados no período"}
        delta={compare && performance?.averageMs !== undefined ? <PeriodDelta current={performance.averageMs} previous={performance.previousAverageMs} mode="percent" format={formatDuration} lowerIsBetter /> : undefined}
      />
      <Metric label="Valor médio por demanda" value={priced && !salaried ? brl(Math.round(totals.earnings / priced)) : "—"} detail="Ganhos ÷ demandas com valor" />
      <Metric label="Sem valor calculado" value={count(totals.unpriced)} detail="Entregas do período com formato não reconhecido" />
      <Metric label="Pontos de atenção" value={count(attentionCount)} detail={attentionCount ? "Tarefas que pedem ação agora" : "Nada pendente agora"} />
    </section>

    <section className="fin-panel">
      <div className="fin-panel-title"><div><span className="fin-eyebrow">Agora</span><h2>Pontos de atenção</h2></div><TriangleAlert size={20} /></div>
      {profile.attention.length ? <ul className="fin-attention">{profile.attention.map((point) => <li key={point.key} className={`is-${point.tone}`}>
        <h3>{point.title}<b>{point.tasks.length}</b></h3>
        <p>{point.detail}</p>
        <ul>{point.tasks.slice(0, 12).map((task) => <li key={task.id}><Link href={`/tarefas/${task.id}`}><span>{task.name}</span><small>{task.projectName}{task.meta ? ` · ${task.meta}` : ""}</small></Link></li>)}</ul>
        {point.tasks.length > 12 ? <p>e mais {point.tasks.length - 12}.</p> : null}
      </li>)}</ul> : <p className="fin-all-clear"><CheckCircle2 size={18} /> Nenhum ponto de atenção: sem atraso, sem ajuste pendente e sem entrega sem valor.</p>}
    </section>

    <div className="fin-columns">
      <section className="fin-panel">
        <div className="fin-panel-title"><div><span className="fin-eyebrow">{period.label}</span><h2>Ganhos por formato</h2></div><BadgeDollarSign size={20} /></div>
        {profile.byFormat.length ? <div className="fin-table-scroll"><table className="fin-table"><thead><tr><th>Formato</th><th>Demandas</th><th>Valor</th></tr></thead><tbody>{profile.byFormat.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td><strong>{brl(row.total)}</strong></td></tr>)}</tbody></table></div>
          : <div className="fin-empty">{salaried ? "No salário fixo as demandas não geram valor por peça." : "Nenhuma demanda com valor neste período."}</div>}
      </section>
      <section className="fin-panel">
        <div className="fin-panel-title"><div><span className="fin-eyebrow">Últimos seis meses</span><h2>Evolução dos ganhos</h2></div><TrendingUp size={20} /></div>
        <div className="fin-chart" role="img" aria-label="Ganhos e demandas computadas nos últimos seis meses">{profile.history.map((row) => <div className="fin-chart-row" key={row.month}><span>{row.month}</span><div><i style={{ width: `${(row.earnings / maxHistory) * 100}%` }} /></div><small>{brl(row.earnings)} · {row.deliveries} {row.deliveries === 1 ? "demanda" : "demandas"}</small></div>)}</div>
        <p className="fin-footnote">Cada mês soma as demandas aprovadas ou finalizadas nele e, quando for o caso, o salário fixo. Não depende do período escolhido acima.</p>
      </section>
    </div>

    <section className="fin-panel">
      <div className="fin-panel-title"><div><span className="fin-eyebrow">{period.label}</span><h2>Demandas computadas · {profile.lines.length}</h2></div><Eye size={20} /></div>
      {profile.lines.length ? <div className="fin-table-scroll"><table className="fin-table fin-production-table"><thead><tr><th>Demanda</th><th>Cliente</th><th>Status atual</th><th>Data computada</th><th>Valor</th><th>Situação</th></tr></thead><tbody>{profile.lines.map((line) => <tr key={line.taskId}>
        <td><Link className="fin-task-link" href={`/tarefas/${line.taskId}`}><Eye size={14} /><span><strong>{line.name}</strong><small>{line.format ?? "Formato não reconhecido"}</small></span></Link></td>
        <td>{line.projectName}</td>
        <td><span className="fin-badge is-ok">{TASK_STATUSES.find((item) => item.value === line.status)?.label ?? line.status}</span></td>
        <td>{formatDueDate(line.deliveredDate)}</td>
        <td><strong>{line.amount === null ? "—" : brl(line.amount)}</strong>{line.note ? <small className={line.situation === "sem_valor" ? "fin-negative" : undefined}>{line.note}</small> : null}</td>
        <td><span className={`fin-badge${SITUATION[line.situation].ok ? " is-ok" : ""}`}>{SITUATION[line.situation].label}</span></td>
      </tr>)}</tbody></table></div> : <div className="fin-empty">Nenhuma tarefa aprovada ou finalizada neste período.</div>}
      <p className="fin-footnote">Entra aqui a tarefa que está hoje em Aprovado ou Finalizado e tem esta pessoa como responsável atual, na data em que foi aprovada. “A lançar” é a estimativa pela tabela de valores de hoje; “Lançada” é o valor que o financeiro já registrou. Tarefas em Problema não entram.</p>
    </section>

    {profile.rates.length ? <section className="fin-panel">
      <div className="fin-panel-title"><div><span className="fin-eyebrow">Valores da produção</span><h2>Tabela de valores</h2></div><BadgeDollarSign size={20} /></div>
      <div className="fin-table-scroll"><table className="fin-table"><thead><tr><th>Entrega</th><th>Unidade</th><th>Pacote de 5</th></tr></thead><tbody>{profile.rates.map((rate) => <tr key={rate.label}><td>{rate.label}</td><td>{brl(rate.unit)}</td><td>{rate.pack === null ? "—" : brl(rate.pack)}</td></tr>)}</tbody></table></div>
      <p className="fin-footnote">O valor é calculado pelo formato da tarefa. Grupos de cinco no mesmo pacote e formato recebem o preço de pacote; o que passar disso usa o preço unitário.</p>
    </section> : null}
  </main>;
}
