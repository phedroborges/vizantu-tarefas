"use client";

import {
  AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CircleGauge, Clock3,
  FileWarning, MessageSquareText, RefreshCcw, Sparkles, UserRoundCheck, UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { buildDashboardMetrics, type DashboardMemberMetric } from "@/lib/dashboard-metrics";
import { formatDuration, formatDueDate } from "@/lib/dates";
import { TASK_STATUSES, type Member, type Project, type Tag, type Task, type TaskStatus } from "@/lib/types";

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
  return <div className="dash-activity"><div className="dash-chart-legend"><span><i className="activity-created" />Criações</span><span><i className="activity-change" />Alterações</span><span><i className="activity-comment" />Comentários</span></div>{rows.map((member) => <div className="dash-activity__row" key={member.memberId}><div><Avatar member={member} small /><span>{member.name}</span></div><div className="dash-activity__track" title={`${member.created} criações, ${member.changes} alterações, ${member.comments} comentários`}><i className="activity-created" style={{ width: `${(member.created / maximum) * 100}%` }} /><i className="activity-change" style={{ width: `${(member.changes / maximum) * 100}%` }} /><i className="activity-comment" style={{ width: `${(member.comments / maximum) * 100}%` }} /></div><strong>{member.totalActivity}</strong></div>)}</div>;
}

export function DashboardView({ tasks, projects, members, tags, nowIso }: DashboardViewProps) {
  const metrics = useMemo(() => buildDashboardMetrics({ tasks, projects, members, tags, nowIso }), [tasks, projects, members, tags, nowIso]);
  const activeMembers = metrics.members; const maxComments = Math.max(1, ...metrics.topCommented.map((task) => task.count));
  return <main className="admin-page dashboard dashboard-intelligence">
    <div className="dashboard-head dashboard-head--intelligence"><div><span className="eyebrow">Inteligência operacional</span><h1>Pulso da operação</h1><p>Gargalos, capacidade, retrabalho e qualidade do planejamento calculados a partir do histórico real das tarefas.</p></div><span className="dash-live"><i /> Dados atualizados ao abrir</span></div>
    <section className="dash-kpi-grid" aria-label="Indicadores principais"><KpiCard icon={<Clock3 size={19} />} tone="violet" label="Ciclo criativo médio" value={metrics.averageCreativeMs === undefined ? "Sem base" : formatDuration(metrics.averageCreativeMs)} detail={`${metrics.creativeDeliveries} entregas com ciclo completo`} /><KpiCard icon={<RefreshCcw size={19} />} tone="amber" label="Taxa de retrabalho" value={`${metrics.reworkRate}%`} detail={`${metrics.reworkedTasks} tarefas passaram por ajuste`} /><KpiCard icon={<CalendarClock size={19} />} tone="red" label="Atrasos ativos" value={metrics.overdueTasks} detail={`de ${metrics.activeTasks} responsabilidades abertas`} /><KpiCard icon={<FileWarning size={19} />} tone="blue" label="Bloqueios de informação" value={metrics.criticalAlerts} detail={`${metrics.alerts.length} inconsistências no total`} /></section>
    <section className="dash-insight-strip" aria-label="Destaques da operação"><div><Sparkles size={18} /><span>Maior tempo criativo</span><strong>{metrics.slowestCreative?.name || "Sem base"}</strong><small>{metrics.slowestCreative?.creativeAverageMs ? `${formatDuration(metrics.slowestCreative.creativeAverageMs)} em média` : "aguardando ciclos completos"}</small></div><div><UsersRound size={18} /><span>Maior carga aberta</span><strong>{metrics.mostLoaded?.name || "Sem equipe"}</strong><small>{metrics.mostLoaded ? `${metrics.mostLoaded.openTasks} responsabilidades` : "—"}</small></div><div><UserRoundCheck size={18} /><span>Mais atividade registrada</span><strong>{metrics.mostActive?.name || "Sem equipe"}</strong><small>{metrics.mostActive ? `${metrics.mostActive.totalActivity} ações` : "—"}</small></div></section>
    <div className="dash-grid dash-grid--wide-left"><section className="panel dash-panel"><PanelHead eyebrow="Fluxo" title="Entrada × entrega" detail="Tarefas criadas e efetivamente finalizadas por semana, nas últimas 8 semanas." /><ThroughputChart rows={metrics.throughput} /></section><section className="panel dash-panel"><PanelHead eyebrow="Atrasos" title="Gravidade do atraso" detail="Distribuição das tarefas abertas que já passaram do prazo." /><DelayChart buckets={metrics.delayBuckets} /></section></div>
    <section className="panel dash-panel dash-panel--full"><PanelHead eyebrow="Gargalos" title="Tempo por pessoa em cada status" detail="Tempo acumulado do histórico das tarefas hoje atribuídas a cada pessoa. Revisitas entram novamente na soma." />{activeMembers.length ? <StatusHeatmap members={activeMembers} /> : <EmptyMetric>Nenhum membro ativo encontrado.</EmptyMetric>}</section>
    <div className="dash-grid"><section className="panel dash-panel"><PanelHead eyebrow="Velocidade" title="Tempo médio até a entrega criativa" detail="Do primeiro status criativo até “Para aprovação”. Barras maiores indicam um ciclo mais lento." /><SpeedChart members={activeMembers} /></section><section className="panel dash-panel"><PanelHead eyebrow="Capacidade" title="Criação × responsabilidade" detail="Compara quem organiza o trabalho com quem concentra a carteira aberta." /><BalanceChart members={activeMembers} /></section></div>
    <div className="dash-grid"><section className="panel dash-panel"><PanelHead eyebrow="Retrabalho" title="Tarefas que mais ficaram em ajuste" detail="Soma todas as entradas em Ajuste, incluindo retornos repetidos." />{metrics.reworkTasks.length ? <div className="dash-task-ranking">{metrics.reworkTasks.map((task, index) => <Link href={`/tarefas/${task.id}`} key={task.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{task.name}</strong><small>{task.projectName}</small></div><div><strong>{formatDuration(task.totalMs || 0)}</strong><small>{task.visits}× em ajuste</small></div><ArrowRight size={15} /></Link>)}</div> : <EmptyMetric>Nenhuma tarefa passou por Ajuste.</EmptyMetric>}</section><section className="panel dash-panel"><PanelHead eyebrow="Colaboração" title="Tarefas com mais comentários" detail="Conversas humanas; alterações automáticas do histórico não entram nessa contagem." />{metrics.topCommented.length ? <div className="dash-comment-ranking">{metrics.topCommented.map((task) => <Link href={`/tarefas/${task.id}`} key={task.id}><div><MessageSquareText size={15} /><span><strong>{task.name}</strong><small>{task.projectName}</small></span><b>{task.count}</b></div><i><span style={{ width: `${(task.count / maxComments) * 100}%` }} /></i></Link>)}</div> : <EmptyMetric>Ainda não há comentários nas tarefas.</EmptyMetric>}</section></div>
    <section className="panel dash-panel dash-panel--full"><PanelHead eyebrow="Qualidade da operação" title="Informações que bloqueiam a próxima etapa" detail="Avisos acionáveis: aprovação sem material é crítica; os demais itens evitam tarefas órfãs ou incompletas." action={<Link className="secondary-button" href="/tarefas">Abrir tarefas</Link>} />{metrics.alerts.length ? <div className="dash-alert-grid">{metrics.alerts.slice(0, 12).map((alert) => <Link href={`/tarefas/${alert.taskId}`} className={alert.critical ? "is-critical" : ""} key={alert.id}><span>{alert.critical ? <AlertTriangle size={16} /> : <FileWarning size={16} />}</span><div><strong>{alert.label}</strong><b>{alert.taskName}</b><small>{alert.projectName}</small></div><ArrowRight size={15} /></Link>)}</div> : <div className="dash-success"><CheckCircle2 size={21} /><div><strong>Nenhum bloqueio encontrado</strong><span>As tarefas abertas têm as informações essenciais para avançar.</span></div></div>}</section>
    <div className="dash-grid dash-grid--wide-right"><section className="panel dash-panel"><PanelHead eyebrow="Planejamento" title="Datas que foram reprogramadas" detail="Preserva o prazo original, o prazo atual e a data real de fechamento." />{metrics.reschedules.length ? <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Tarefa</th><th>Original</th><th>Atual</th><th>Fechada</th><th>Impacto</th></tr></thead><tbody>{metrics.reschedules.slice(0, 10).map((row) => <tr key={row.id}><td><Link href={`/tarefas/${row.taskId}`}><strong>{row.taskName}</strong><span>{row.projectName}</span></Link></td><td>{formatDueDate(row.originalDate)}</td><td>{formatDueDate(row.currentDate)}</td><td>{row.completedDate ? formatDueDate(row.completedDate) : "Aberta"}</td><td><strong className={row.movedDays > 0 ? "is-negative" : "is-positive"}>{row.movedDays > 0 ? `+${row.movedDays}` : row.movedDays}d</strong><span>{row.changes} {row.changes === 1 ? "mudança" : "mudanças"}</span></td></tr>)}</tbody></table></div> : <EmptyMetric>Nenhuma mudança de prazo registrada.</EmptyMetric>}</section><section className="panel dash-panel"><PanelHead eyebrow="Adoção" title="Atividade dentro do sistema" detail="Criações, alterações de campos e comentários. Pessoas sem ações continuam visíveis." /><ActivityChart members={activeMembers} /></section></div>
  </main>;
}
