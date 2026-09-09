"use client";

import {
  AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CircleGauge, Clock3, Gauge,
  FileWarning, Hourglass, MessageSquareText, RefreshCcw, Sparkles, Target, TrendingUp,
  UserRoundCheck, UserRoundX, UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import {
  buildDashboardMetrics,
  type DashboardAgingItem, type DashboardFlowPoint, type DashboardLeadTime,
  type DashboardMemberMetric, type DashboardProjectHealth, type DashboardPunctuality,
} from "@/lib/dashboard-metrics";
import { formatDuration, formatDueDate } from "@/lib/dates";
import { TASK_STATUSES, type Member, type Project, type StatusGroup, type Tag, type Task, type TaskStatus } from "@/lib/types";

type DashboardViewProps = { tasks: Task[]; projects: Project[]; members: Member[]; tags: Tag[]; nowIso: string };

const STATUS_SHORT: Record<TaskStatus, string> = {
  rascunho: "Rasc.", aguardando_informacao: "Info.", aprovacao_copy: "Copy", aguardando_captacao: "Capt.",
  pronto_para_criacao: "Pronto", em_criacao: "Criação", revisao: "Revisão", ajuste: "Ajuste",
  para_aprovacao: "P/ aprov.", aprovado: "Aprov.", problema: "Problema", finalizado: "Final.",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  rascunho: "#a7adba", aguardando_informacao: "#8292a5", aprovacao_copy: "#6481a5", aguardando_captacao: "#55718e",
  pronto_para_criacao: "#e3a539", em_criacao: "#d98a2d", revisao: "#c96d32", ajuste: "#b74f38",
  para_aprovacao: "#79a849", aprovado: "#58a061", problema: "#c8413a", finalizado: "#267650",
};

// A fila engrossando, a produção inchando e a entrega subindo são três leituras
// diferentes — cada faixa do fluxo cumulativo ganha a cor do seu grupo.
const FLOW_SERIES: { key: StatusGroup; label: string; color: string }[] = [
  { key: "feita", label: "Entregue", color: "#267650" },
  { key: "em_andamento", label: "Em produção", color: "#e3a539" },
  { key: "nao_iniciada", label: "Na fila", color: "#6481a5" },
];

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

function Avatar({ member, small = false }: { member: DashboardMemberMetric; small?: boolean }) {
  return member.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`dash-avatar${small ? " is-small" : ""}`} src={member.avatarUrl} alt="" />
  ) : <span className={`dash-avatar dash-avatar--initials${small ? " is-small" : ""}`}>{initials(member.name)}</span>;
}

function EmptyMetric({ children }: { children: string }) {
  return <div className="dash-empty"><CircleGauge size={26} /><span>{children}</span></div>;
}

function KpiCard({ icon, tone, label, value, detail }: { icon: React.ReactNode; tone: string; label: string; value: string | number; detail: string }) {
  return <article className={`dash-kpi dash-kpi--${tone}`}><span className="dash-kpi__icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

function PanelHead({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
  return <header className="dash-panel-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div>{action}</header>;
}

function ThroughputChart({ rows }: { rows: { label: string; created: number; completed: number }[] }) {
  const width = 720, height = 210, padX = 24, padY = 22;
  const maximum = Math.max(1, ...rows.flatMap((row) => [row.created, row.completed]));
  const point = (value: number, index: number) => ({ x: padX + (index * (width - padX * 2)) / Math.max(1, rows.length - 1), y: height - padY - (value / maximum) * (height - padY * 2) });
  const line = (key: "created" | "completed") => rows.map((row, index) => { const { x, y } = point(row[key], index); return `${x},${y}`; }).join(" ");
  return <div className="dash-line-chart">
    <div className="dash-chart-legend"><span><i className="created" />Criadas</span><span><i className="completed" />Finalizadas</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tarefas criadas e finalizadas nas últimas oito semanas">
      {[0, .25, .5, .75, 1].map((portion) => <line key={portion} x1={padX} x2={width - padX} y1={padY + portion * (height - padY * 2)} y2={padY + portion * (height - padY * 2)} className="dash-chart-grid" />)}
      <polyline points={line("created")} className="dash-chart-line dash-chart-line--created" /><polyline points={line("completed")} className="dash-chart-line dash-chart-line--completed" />
      {rows.flatMap((row, index) => (["created", "completed"] as const).map((key) => { const { x, y } = point(row[key], index); return <circle key={`${key}:${index}`} cx={x} cy={y} r="4" className={`dash-chart-dot dash-chart-dot--${key}`}><title>{`${row.label}: ${row[key]} ${key === "created" ? "criadas" : "finalizadas"}`}</title></circle>; }))}
    </svg><div className="dash-chart-axis">{rows.map((row) => <span key={row.label}>{row.label}</span>)}</div>
  </div>;
}

function CumulativeFlowChart({ rows }: { rows: DashboardFlowPoint[] }) {
  const width = 720, height = 224, padX = 26, padY = 18;
  const maximum = Math.max(1, ...rows.map((row) => row.total));
  const x = (index: number) => padX + (index * (width - padX * 2)) / Math.max(1, rows.length - 1);
  const y = (value: number) => height - padY - (value / maximum) * (height - padY * 2);
  const stacks = rows.map((row) => { let running = 0; return FLOW_SERIES.map((series) => { const from = running; running += row[series.key]; return { from, to: running }; }); });
  const area = (index: number) => {
    const top = rows.map((_, position) => `${x(position)},${y(stacks[position][index].to)}`);
    const bottom = rows.map((_, position) => `${x(position)},${y(stacks[position][index].from)}`).toReversed();
    return `M${top.join(" L")} L${bottom.join(" L")} Z`;
  };
  const last = rows.at(-1);
  return <div className="dash-line-chart">
    <div className="dash-chart-legend">{FLOW_SERIES.map((series) => <span key={series.key}><i style={{ background: series.color }} />{series.label}{last ? ` · ${last[series.key]}` : ""}</span>)}</div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Distribuição semanal das tarefas entre fila, produção e entrega">
      {[0, .25, .5, .75, 1].map((portion) => <line key={portion} x1={padX} x2={width - padX} y1={padY + portion * (height - padY * 2)} y2={padY + portion * (height - padY * 2)} className="dash-chart-grid" />)}
      {FLOW_SERIES.map((series, index) => <path key={series.key} d={area(index)} fill={series.color} fillOpacity=".82" stroke={series.color} strokeWidth="1"><title>{`${series.label}: ${rows.map((row) => `${row.label} ${row[series.key]}`).join(", ")}`}</title></path>)}
    </svg><div className="dash-chart-axis">{rows.map((row) => <span key={row.start}>{row.label}</span>)}</div>
  </div>;
}

function FlowEfficiencyGauge({ flow, leadTime }: { flow: { workingMs: number; waitingMs: number; ratio: number }; leadTime: DashboardLeadTime }) {
  const circumference = 289, filled = (flow.ratio / 100) * circumference;
  return <div className="dash-gauge">
    <div className="dash-donut" role="img" aria-label={`Eficiência de fluxo de ${flow.ratio}%`}>
      <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" className="dash-donut__track" /><circle cx="60" cy="60" r="46" className="dash-donut__slice" stroke="var(--vz-brand)" strokeDasharray={`${filled} ${circumference - filled}`} /></svg>
      <div><strong>{flow.ratio}%</strong><span>com a mão na massa</span></div>
    </div>
    <ul className="dash-gauge__legend">
      <li><i style={{ background: "var(--vz-brand)" }} /><span>Produzindo</span><strong>{formatDuration(flow.workingMs)}</strong></li>
      <li><i style={{ background: "var(--vz-panel-muted)", border: "1px solid var(--vz-line)" }} /><span>Esperando</span><strong>{formatDuration(flow.waitingMs)}</strong></li>
      <li><i style={{ background: "var(--vz-green-solid)" }} /><span>Prazo confiável (P85)</span><strong>{leadTime.p85Ms === undefined ? "Sem base" : formatDuration(leadTime.p85Ms)}</strong></li>
    </ul>
  </div>;
}

function AgingChart({ items, threshold }: { items: DashboardAgingItem[]; threshold: number }) {
  const statuses = TASK_STATUSES.filter(({ value }) => items.some((item) => item.status === value));
  if (!statuses.length) return <EmptyMetric>Nenhuma tarefa aberta com histórico de status.</EmptyMetric>;
  const width = 940, rowHeight = 38, padLeft = 96, padRight = 26, padTop = 12;
  const height = padTop + statuses.length * rowHeight + 26;
  // O eixo acompanha os dados. Esticá-lo até o limite saudável quando ninguém
  // chegou perto dele empilharia todos os pontos num canto e esconderia a
  // diferença entre uma tarefa de 1 dia e outra de 3.
  const porStatus = new Map(statuses.map(({ value }) => [value, items.filter((item) => item.status === value).map((item) => item.taskId)]));
  const maiorEspera = Math.max(1, ...items.map((item) => item.days));
  const dentroDaEscala = threshold > 0 && threshold <= maiorEspera * 1.15;
  const maximum = dentroDaEscala ? Math.max(maiorEspera, threshold) : maiorEspera;
  const x = (days: number) => padLeft + (days / maximum) * (width - padLeft - padRight);
  const casas = maximum < 8 ? 1 : 0;
  const ticks = Array.from({ length: 5 }, (_, index) => Number(((maximum / 4) * index).toFixed(casas)));
  return <div className="dash-scatter">
    <div className="dash-chart-legend"><span><i style={{ background: "var(--vz-brand)" }} />No prazo</span><span><i style={{ background: "var(--vz-red-solid)" }} />Já atrasada</span>{dentroDaEscala ? <span><i className="dash-scatter__threshold-key" />Limite saudável ({threshold}d)</span> : <span className="dash-scatter__ok">Ninguém passou do limite saudável de {threshold}d</span>}</div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Dias que cada tarefa aberta está parada no status atual">
      {statuses.map(({ value }, index) => <line key={value} x1={padLeft} x2={width - padRight} y1={padTop + index * rowHeight + rowHeight / 2} y2={padTop + index * rowHeight + rowHeight / 2} className="dash-chart-grid" />)}
      {ticks.map((tick, index) => <text key={index} x={x(tick)} y={height - 8} className="dash-scatter__tick">{tick}d</text>)}
      {statuses.map(({ value, label }, index) => <text key={value} x={padLeft - 10} y={padTop + index * rowHeight + rowHeight / 2 + 3} className="dash-scatter__label"><title>{label}</title>{STATUS_SHORT[value]}</text>)}
      {dentroDaEscala ? <line x1={x(threshold)} x2={x(threshold)} y1={padTop} y2={height - 22} className="dash-scatter__threshold" /> : null}
      {items.map((item) => {
        const index = statuses.findIndex((status) => status.value === item.status);
        // Um leve escalonamento vertical evita que tarefas com o mesmo tempo no
        // mesmo status virem um ponto só e escondam a quantidade real. Só entra
        // onde a linha está cheia: com dois pontos ele pareceria desalinho.
        const vizinhos = porStatus.get(item.status)!;
        const jitter = vizinhos.length > 2 ? ((vizinhos.indexOf(item.taskId) % 5) - 2) * 3.2 : 0;
        return <circle key={item.taskId} cx={x(item.days)} cy={padTop + index * rowHeight + rowHeight / 2 + jitter} r={dentroDaEscala && item.days >= threshold ? 6 : 5}
          fill={item.overdue ? "var(--vz-red-solid)" : "var(--vz-brand)"} fillOpacity=".78" stroke="var(--vz-panel)" strokeWidth="1.5">
          <title>{`${item.taskName} — ${item.projectName}\n${item.days}d em ${STATUS_SHORT[item.status]}${item.assigneeName ? ` · ${item.assigneeName}` : " · sem responsável"}`}</title>
        </circle>;
      })}
    </svg>
    <div className="dash-scatter__worst">{items.slice(0, 4).map((item) => <Link href={`/tarefas/${item.taskId}`} key={item.taskId}><strong>{item.days}d</strong><span><b>{item.taskName}</b><small>{STATUS_SHORT[item.status]} · {item.projectName}</small></span></Link>)}</div>
  </div>;
}

function LeadTimeChart({ leadTime }: { leadTime: DashboardLeadTime }) {
  if (!leadTime.samples) return <EmptyMetric>Nenhuma tarefa finalizada com histórico para medir o prazo.</EmptyMetric>;
  const maximum = Math.max(1, ...leadTime.histogram.map((bucket) => bucket.count));
  return <div className="dash-histogram">
    <div className="dash-histogram__bars">{leadTime.histogram.map((bucket) => <div key={bucket.label} title={`${bucket.count} tarefas`}><i style={{ height: `${Math.max(3, (bucket.count / maximum) * 100)}%` }} /><b>{bucket.count}</b><span>{bucket.label}</span></div>)}</div>
    <div className="dash-histogram__marks">
      <div><span>Mediana</span><strong>{leadTime.p50Ms === undefined ? "—" : formatDuration(leadTime.p50Ms)}</strong><small>metade fecha em até isso</small></div>
      <div><span>P85</span><strong>{leadTime.p85Ms === undefined ? "—" : formatDuration(leadTime.p85Ms)}</strong><small>o prazo que dá pra prometer</small></div>
      <div><span>Base</span><strong>{leadTime.samples}</strong><small>tarefas finalizadas medidas</small></div>
    </div>
  </div>;
}

function PunctualityChart({ punctuality }: { punctuality: DashboardPunctuality }) {
  if (!punctuality.delivered) return <EmptyMetric>Ainda não há entregas fechadas com prazo definido.</EmptyMetric>;
  const rows = [
    { label: "Na data prometida no início", rate: punctuality.originalRate, count: punctuality.keptOriginal, tone: "original" },
    { label: "Na data depois de remarcar", rate: punctuality.currentRate, count: punctuality.keptCurrent, tone: "current" },
  ];
  return <div className="dash-punctuality">
    {rows.map((row) => <div className="dash-punctuality__row" key={row.tone}>
      <span>{row.label}</span>
      <div className={`dash-punctuality__track is-${row.tone}`}><i style={{ width: `${row.rate}%` }} /></div>
      <strong>{row.rate}%</strong><small>{row.count} de {punctuality.delivered}</small>
    </div>)}
    <p className="dash-footnote">A distância entre as duas barras é o tanto que o planejamento precisou ser empurrado para a entrega caber. Em média cada entrega fechou {punctuality.averageSlipDays > 0 ? `${punctuality.averageSlipDays} dias depois` : `${Math.abs(punctuality.averageSlipDays)} dias antes`} da data prometida no início.</p>
  </div>;
}

function ProjectHealthTable({ rows }: { rows: DashboardProjectHealth[] }) {
  if (!rows.length) return <EmptyMetric>Nenhum projeto com tarefas cadastradas.</EmptyMetric>;
  return <div className="dash-table-wrap"><table className="dash-table dash-table--health">
    <thead><tr><th>Cliente</th><th>Progresso</th><th>Abertas</th><th>Atrasadas</th><th>Retrabalho</th><th>Avisos</th><th>Prazo médio</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}>
      <td><Link href={`/projetos/${row.id}`}><strong>{row.name}</strong><span>{row.done} de {row.total} finalizadas</span></Link></td>
      <td><div className="dash-mini-bar"><i style={{ width: `${row.progress}%` }} /></div><span>{row.progress}%</span></td>
      <td>{row.open}</td>
      <td><span className={row.overdue ? "dash-pill is-red" : "dash-pill"}>{row.overdue}</span></td>
      <td><span className={row.rework ? "dash-pill is-amber" : "dash-pill"}>{row.rework}</span></td>
      <td><span className={row.alerts ? "dash-pill is-blue" : "dash-pill"}>{row.alerts}</span></td>
      <td>{row.leadTimeMs === undefined ? "—" : formatDuration(row.leadTimeMs)}</td>
    </tr>)}</tbody>
  </table></div>;
}

function DelayChart({ buckets }: { buckets: { label: string; count: number; color: string }[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const slices = buckets.map((bucket, index) => {
    const length = (total ? bucket.count / total : 0) * 289;
    const offset = buckets.slice(0, index).reduce((sum, previous) => sum + (total ? previous.count / total : 0) * 289, 0);
    return { ...bucket, length, offset };
  });
  return <div className="dash-delay"><div className="dash-donut" role="img" aria-label={`${total} tarefas atrasadas`}><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" className="dash-donut__track" />{slices.map((bucket) => <circle key={bucket.label} cx="60" cy="60" r="46" className="dash-donut__slice" stroke={bucket.color} strokeDasharray={`${bucket.length} ${289 - bucket.length}`} strokeDashoffset={-bucket.offset}><title>{`${bucket.label}: ${bucket.count}`}</title></circle>)}</svg><div><strong>{total}</strong><span>atrasadas</span></div></div><ul>{buckets.map((bucket) => <li key={bucket.label}><i style={{ background: bucket.color }} /><span>{bucket.label}</span><strong>{bucket.count}</strong></li>)}</ul></div>;
}

function StatusHeatmap({ members }: { members: DashboardMemberMetric[] }) {
  const maximum = Math.max(1, ...members.flatMap((member) => TASK_STATUSES.map(({ value }) => member.statusMs[value])));
  return <div className="dash-heatmap-wrap"><div className="dash-heatmap" style={{ "--dash-status-count": TASK_STATUSES.length } as React.CSSProperties}>
    <div className="dash-heatmap__corner">Pessoa</div>{TASK_STATUSES.map(({ value, label }) => <div className="dash-heatmap__status" title={label} key={value}>{STATUS_SHORT[value]}</div>)}<div className="dash-heatmap__status">Total</div>
    {members.map((member) => <div className="dash-heatmap__row" key={member.memberId}><div className="dash-heatmap__person"><Avatar member={member} small /><span>{member.name}</span></div>{TASK_STATUSES.map(({ value }) => { const duration = member.statusMs[value]; const alpha = duration ? .12 + (duration / maximum) * .76 : 0; return <div key={value} className="dash-heatmap__cell" style={{ background: duration ? `color-mix(in srgb, ${STATUS_COLORS[value]} ${Math.round(alpha * 100)}%, transparent)` : undefined }} title={`${STATUS_SHORT[value]}: ${formatDuration(duration)}`}>{duration ? formatDuration(duration) : "—"}</div>; })}<div className="dash-heatmap__total">{member.totalStatusMs ? formatDuration(member.totalStatusMs) : "—"}</div></div>)}
  </div></div>;
}

function SpeedChart({ members }: { members: DashboardMemberMetric[] }) {
  const rows = members.filter((member) => member.creativeAverageMs !== undefined).sort((a, b) => (b.creativeAverageMs || 0) - (a.creativeAverageMs || 0)); const maximum = rows[0]?.creativeAverageMs || 1;
  if (!rows.length) return <EmptyMetric>O histórico ainda não tem ciclos criativos concluídos.</EmptyMetric>;
  return <div className="dash-bars">{rows.map((member, index) => <div className={`dash-bar-row${index === 0 ? " is-alert" : ""}`} key={member.memberId}><div className="dash-bar-label"><Avatar member={member} small /><span><strong>{member.name}</strong><small>{member.creativeDeliveries} {member.creativeDeliveries === 1 ? "entrega medida" : "entregas medidas"}</small></span></div><div className="dash-bar-track"><i style={{ width: `${Math.max(4, ((member.creativeAverageMs || 0) / maximum) * 100)}%` }} /></div><strong>{formatDuration(member.creativeAverageMs || 0)}</strong></div>)}</div>;
}

function BalanceChart({ members }: { members: DashboardMemberMetric[] }) {
  const maximum = Math.max(1, ...members.flatMap((member) => [member.created, member.openTasks]));
  return <div className="dash-balance"><div className="dash-balance__labels"><span>Tarefas criadas</span><span>Responsabilidades abertas</span></div>{members.map((member) => <div className="dash-balance__row" key={member.memberId}><div className="dash-balance__left"><strong>{member.created}</strong><i style={{ width: `${(member.created / maximum) * 100}%` }} /></div><div className="dash-balance__member" title={member.name}><Avatar member={member} small /><span>{member.name}</span></div><div className="dash-balance__right"><i style={{ width: `${(member.openTasks / maximum) * 100}%` }} /><strong>{member.openTasks}</strong></div></div>)}<p className="dash-footnote">“Criadas” passa a ser registrado a partir desta versão; tarefas antigas permanecem sem autoria.</p></div>;
}

function ActivityChart({ members }: { members: DashboardMemberMetric[] }) {
  const rows = [...members].sort((a, b) => b.totalActivity - a.totalActivity); const maximum = Math.max(1, ...rows.map((member) => member.totalActivity));
  return <div className="dash-activity"><div className="dash-chart-legend"><span><i className="activity-created" />Criações</span><span><i className="activity-change" />Alterações</span><span><i className="activity-comment" />Comentários</span></div>{rows.map((member) => <div className={`dash-activity__row${member.totalActivity ? "" : " is-idle"}`} key={member.memberId}><div><Avatar member={member} small /><span>{member.name}</span></div><div className="dash-activity__track" title={`${member.created} criações, ${member.changes} alterações, ${member.comments} comentários`}><i className="activity-created" style={{ width: `${(member.created / maximum) * 100}%` }} /><i className="activity-change" style={{ width: `${(member.changes / maximum) * 100}%` }} /><i className="activity-comment" style={{ width: `${(member.comments / maximum) * 100}%` }} /></div><strong>{member.totalActivity}</strong></div>)}</div>;
}

export function DashboardView({ tasks, projects, members, tags, nowIso }: DashboardViewProps) {
  const metrics = useMemo(() => buildDashboardMetrics({ tasks, projects, members, tags, nowIso }), [tasks, projects, members, tags, nowIso]);
  const activeMembers = metrics.members;
  const maxComments = Math.max(1, ...metrics.topCommented.map((task) => task.count));
  const lastWeek = metrics.throughput.at(-1);
  return <main className="admin-page dashboard dashboard-intelligence">
    <div className="dashboard-head dashboard-head--intelligence"><div><span className="eyebrow">Inteligência operacional</span><h1>Pulso da operação</h1><p>Gargalos, capacidade, retrabalho e qualidade do planejamento calculados a partir do histórico real das tarefas.</p></div><span className="dash-live"><i /> Dados atualizados ao abrir</span></div>

    <section className="dash-kpi-grid" aria-label="Indicadores principais">
      <KpiCard icon={<Clock3 size={19} />} tone="violet" label="Ciclo criativo médio" value={metrics.averageCreativeMs === undefined ? "Sem base" : formatDuration(metrics.averageCreativeMs)} detail={`${metrics.creativeDeliveries} entregas com ciclo completo`} />
      <KpiCard icon={<Gauge size={19} />} tone="blue" label="Eficiência de fluxo" value={`${metrics.flowEfficiency.ratio}%`} detail={`${formatDuration(metrics.flowEfficiency.waitingMs)} de espera acumulada`} />
      <KpiCard icon={<Target size={19} />} tone="green" label="Entrega na data prometida" value={`${metrics.punctuality.originalRate}%`} detail={`${metrics.punctuality.keptOriginal} de ${metrics.punctuality.delivered} entregas fecharam no prazo original`} />
      <KpiCard icon={<Hourglass size={19} />} tone="violet" label="Prazo confiável (P85)" value={metrics.leadTime.p85Ms === undefined ? "Sem base" : formatDuration(metrics.leadTime.p85Ms)} detail={`85% das ${metrics.leadTime.samples} tarefas medidas fecham até aí`} />
      <KpiCard icon={<RefreshCcw size={19} />} tone="amber" label="Taxa de retrabalho" value={`${metrics.reworkRate}%`} detail={`${metrics.reworkedTasks} tarefas passaram por ajuste`} />
      <KpiCard icon={<CalendarClock size={19} />} tone="red" label="Atrasos ativos" value={metrics.overdueTasks} detail={`de ${metrics.activeTasks} responsabilidades abertas`} />
      <KpiCard icon={<FileWarning size={19} />} tone="blue" label="Bloqueios de informação" value={metrics.criticalAlerts} detail={`${metrics.alerts.length} inconsistências no total`} />
      <KpiCard icon={<TrendingUp size={19} />} tone="green" label="Entregas na semana" value={lastWeek?.completed ?? 0} detail={`${lastWeek?.created ?? 0} tarefas criadas no mesmo período`} />
    </section>

    <section className="dash-insight-strip" aria-label="Destaques da operação">
      <div><Sparkles size={18} /><span>Maior tempo criativo</span><strong>{metrics.slowestCreative?.name || "Sem base"}</strong><small>{metrics.slowestCreative?.creativeAverageMs ? `${formatDuration(metrics.slowestCreative.creativeAverageMs)} em média` : "aguardando ciclos completos"}</small></div>
      <div><UsersRound size={18} /><span>Maior carga aberta</span><strong>{metrics.mostLoaded?.name || "Sem equipe"}</strong><small>{metrics.mostLoaded ? `${metrics.mostLoaded.openTasks} responsabilidades` : "—"}</small></div>
      <div><UserRoundCheck size={18} /><span>Mais atividade registrada</span><strong>{metrics.mostActive?.name || "Sem equipe"}</strong><small>{metrics.mostActive ? `${metrics.mostActive.totalActivity} ações` : "—"}</small></div>
      <div><UserRoundX size={18} /><span>Sem nenhuma atividade</span><strong>{metrics.idleMembers.length ? metrics.idleMembers.map((member) => member.name).join(", ") : "Ninguém parado"}</strong><small>{metrics.idleMembers.length ? `${metrics.idleMembers.length} de ${activeMembers.length} pessoas sem ação e sem carteira` : "todo mundo com ação registrada"}</small></div>
    </section>

    <div className="dash-grid dash-grid--wide-left">
      <section className="panel dash-panel"><PanelHead eyebrow="Fluxo" title="Fila, produção e entrega semana a semana" detail="Faixa que engrossa é fila que se acumula. Quando a de produção incha sem a verde subir, o time está começando mais do que termina." /><CumulativeFlowChart rows={metrics.cumulativeFlow} /></section>
      <section className="panel dash-panel"><PanelHead eyebrow="Eficiência" title="Trabalhando × esperando" detail="Quanto do tempo sob nossa responsabilidade alguém estava de fato produzindo." /><FlowEfficiencyGauge flow={metrics.flowEfficiency} leadTime={metrics.leadTime} /></section>
    </div>

    <section className="panel dash-panel dash-panel--full"><PanelHead eyebrow="Envelhecimento" title="Há quanto tempo cada tarefa aberta está parada" detail="Cada ponto é uma tarefa, posicionada pelos dias no status atual. O que passa da linha vermelha já está velho antes mesmo de estourar o prazo." action={<Link className="secondary-button" href="/tarefas">Abrir tarefas</Link>} /><AgingChart items={metrics.aging} threshold={metrics.agingThresholdDays} /></section>

    <div className="dash-grid dash-grid--wide-left">
      <section className="panel dash-panel"><PanelHead eyebrow="Fluxo" title="Entrada × entrega" detail="Tarefas criadas e efetivamente finalizadas por semana, nas últimas 8 semanas." /><ThroughputChart rows={metrics.throughput} /></section>
      <section className="panel dash-panel"><PanelHead eyebrow="Atrasos" title="Gravidade do atraso" detail="Distribuição das tarefas abertas que já passaram do prazo." /><DelayChart buckets={metrics.delayBuckets} /></section>
    </div>

    <section className="panel dash-panel dash-panel--full"><PanelHead eyebrow="Gargalos" title="Tempo por pessoa em cada status" detail="Tempo acumulado do histórico das tarefas hoje atribuídas a cada pessoa. Revisitas entram novamente na soma." />{activeMembers.length ? <StatusHeatmap members={activeMembers} /> : <EmptyMetric>Nenhum membro ativo encontrado.</EmptyMetric>}</section>

    <div className="dash-grid">
      <section className="panel dash-panel"><PanelHead eyebrow="Velocidade" title="Tempo médio até a entrega criativa" detail="Do primeiro status criativo até “Para aprovação”. Barras maiores indicam um ciclo mais lento." /><SpeedChart members={activeMembers} /></section>
      <section className="panel dash-panel"><PanelHead eyebrow="Capacidade" title="Criação × responsabilidade" detail="Compara quem organiza o trabalho com quem concentra a carteira aberta." /><BalanceChart members={activeMembers} /></section>
    </div>

    <div className="dash-grid">
      <section className="panel dash-panel"><PanelHead eyebrow="Previsibilidade" title="Quanto tempo uma tarefa leva para fechar" detail="Distribuição do prazo real entre a criação e o fechamento das tarefas já finalizadas." /><LeadTimeChart leadTime={metrics.leadTime} /></section>
      <section className="panel dash-panel"><PanelHead eyebrow="Promessa" title="A data combinada se sustentou?" detail="Compara a entrega com a data prometida no início e com a data já remarcada." /><PunctualityChart punctuality={metrics.punctuality} /></section>
    </div>

    <div className="dash-grid">
      <section className="panel dash-panel"><PanelHead eyebrow="Retrabalho" title="Tarefas que mais ficaram em ajuste" detail="Soma todas as entradas em Ajuste, incluindo retornos repetidos." />{metrics.reworkTasks.length ? <div className="dash-task-ranking">{metrics.reworkTasks.map((task, index) => <Link href={`/tarefas/${task.id}`} key={task.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{task.name}</strong><small>{task.projectName}</small></div><div><strong>{formatDuration(task.totalMs || 0)}</strong><small>{task.visits}× em ajuste</small></div><ArrowRight size={15} /></Link>)}</div> : <EmptyMetric>Nenhuma tarefa passou por Ajuste.</EmptyMetric>}</section>
      <section className="panel dash-panel"><PanelHead eyebrow="Colaboração" title="Tarefas com mais comentários" detail="Conversas humanas; alterações automáticas do histórico não entram nessa contagem." />{metrics.topCommented.length ? <div className="dash-comment-ranking">{metrics.topCommented.map((task) => <Link href={`/tarefas/${task.id}`} key={task.id}><div><MessageSquareText size={15} /><span><strong>{task.name}</strong><small>{task.projectName}</small></span><b>{task.count}</b></div><i><span style={{ width: `${(task.count / maxComments) * 100}%` }} /></i></Link>)}</div> : <EmptyMetric>Ainda não há comentários nas tarefas.</EmptyMetric>}</section>
    </div>

    <section className="panel dash-panel dash-panel--full"><PanelHead eyebrow="Qualidade da operação" title="Informações que bloqueiam a próxima etapa" detail="O mesmo aviso aparece dentro da tarefa para quem está com ela na mão: aprovação sem material é crítica." action={<Link className="secondary-button" href="/tarefas">Abrir tarefas</Link>} />{metrics.alerts.length ? <div className="dash-alert-grid">{metrics.alerts.slice(0, 12).map((alert) => <Link href={`/tarefas/${alert.taskId}`} className={alert.critical ? "is-critical" : ""} key={alert.id}><span>{alert.critical ? <AlertTriangle size={16} /> : <FileWarning size={16} />}</span><div><strong>{alert.label}</strong><b>{alert.taskName}</b><small>{alert.projectName}</small></div><ArrowRight size={15} /></Link>)}</div> : <div className="dash-success"><CheckCircle2 size={21} /><div><strong>Nenhum bloqueio encontrado</strong><span>As tarefas abertas têm as informações essenciais para avançar.</span></div></div>}</section>

    <div className="dash-grid dash-grid--wide-right">
      <section className="panel dash-panel"><PanelHead eyebrow="Planejamento" title="Datas que foram reprogramadas" detail="Preserva o prazo original, o prazo atual e a data real de fechamento." />{metrics.reschedules.length ? <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Tarefa</th><th>Original</th><th>Atual</th><th>Fechada</th><th>Impacto</th></tr></thead><tbody>{metrics.reschedules.slice(0, 10).map((row) => <tr key={row.id}><td><Link href={`/tarefas/${row.taskId}`}><strong>{row.taskName}</strong><span>{row.projectName}</span></Link></td><td>{formatDueDate(row.originalDate)}</td><td>{formatDueDate(row.currentDate)}</td><td>{row.completedDate ? formatDueDate(row.completedDate) : "Aberta"}</td><td><strong className={row.movedDays > 0 ? "is-negative" : "is-positive"}>{row.movedDays > 0 ? `+${row.movedDays}` : row.movedDays}d</strong><span>{row.changes} {row.changes === 1 ? "mudança" : "mudanças"}</span></td></tr>)}</tbody></table></div> : <EmptyMetric>Nenhuma mudança de prazo registrada.</EmptyMetric>}</section>
      <section className="panel dash-panel"><PanelHead eyebrow="Adoção" title="Atividade dentro do sistema" detail="Criações, alterações de campos e comentários. Quem não registrou nada fica marcado." /><ActivityChart members={activeMembers} /></section>
    </div>

    <section className="panel dash-panel dash-panel--full"><PanelHead eyebrow="Carteira" title="Saúde por cliente" detail="Ordenado por atraso: o cliente do topo é o que precisa de decisão hoje." action={<Link className="secondary-button" href="/projetos">Ver projetos</Link>} /><ProjectHealthTable rows={metrics.projectHealth} /></section>
  </main>;
}
