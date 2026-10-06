"use client";

import {
  AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CircleGauge, Clock3, Gauge,
  FileWarning, Hourglass, Info, MessageSquareText, RefreshCcw, Sparkles, Target, TrendingUp,
  UserRoundCheck, UserRoundX, UsersRound,
} from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import {
  TIMED_STATUSES,
  type DashboardMetrics,
  type DashboardFlowPoint, type DashboardLeadTime,
  type DashboardMemberMetric, type DashboardProjectHealth, type DashboardPunctuality,
} from "@/lib/dashboard-metrics";
import { formatDuration, formatDueDate } from "@/lib/dates";
import { type StatusGroup, type TaskStatus } from "@/lib/types";

type DashboardViewProps = { metrics: DashboardMetrics };

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

// O que cada métrica quer dizer e a conta por trás dela. Aparece no ícone de
// informação de cada indicador e de cada gráfico.
const INFO = {
  kpiCiclo: { what: "Quanto tempo, em média, uma demanda leva da entrada na criação até ser aprovada.", how: "O relógio liga quando a tarefa entra em “Pronto para criação” e desliga quando chega a “Aprovado” ou “Finalizado”. Se ela volta para “Ajuste”, liga de novo e soma. Se volta para uma etapa anterior (texto, captação), pausa. Média = soma dos ciclos fechados ÷ número de tarefas com ciclo fechado." },
  kpiEficiencia: { what: "De todo o tempo em que as demandas ficaram abertas, quanto alguém estava de fato produzindo.", how: "Tempo produzindo (Em criação + Revisão + Ajuste) ÷ (tempo produzindo + tempo esperando). Esperando = Rascunho, Aguardando informação, Aprovação de texto, Aguardando captação, Pronto para criação e Para aprovação. Aprovado, Finalizado e Problema não entram." },
  kpiPontualidade: { what: "Quantas entregas fecharam até a primeira data combinada, antes de qualquer remarcação.", how: "Tarefas finalizadas até a data original ÷ tarefas finalizadas que tinham prazo. A data original é a que existia antes da primeira mudança de prazo registrada." },
  kpiP85: { what: "O prazo que dá para prometer com segurança: 85% das tarefas já finalizadas fecharam dentro dele.", how: "Para cada tarefa finalizada: momento em que entrou em “Finalizado” − momento da criação. Ordena do menor para o maior e pega o valor na posição dos 85%." },
  kpiRetrabalho: { what: "De cada 100 demandas que entraram na criação, quantas precisaram voltar para ajuste.", how: "Tarefas que passaram por “Ajuste” pelo menos uma vez ÷ tarefas que chegaram a entrar em criação (Pronto para criação em diante)." },
  kpiAtrasos: { what: "Quantas demandas abertas já passaram do prazo hoje.", how: "Conta as tarefas com prazo anterior a hoje que ainda não foram enviadas para aprovação. Para aprovação, Aprovado, Finalizado e Problema não contam como atraso." },
  kpiBloqueios: { what: "Tarefas abertas sem uma informação obrigatória para avançar.", how: "Conta os avisos críticos (por exemplo, aprovação sem link do material). O total de inconsistências inclui também falta de responsável, prazo, formato e canal." },
  kpiSemana: { what: "O que entrou e o que saiu nesta semana (segunda a domingo).", how: "Entregas = tarefas que entraram em “Finalizado” nesta semana. Criadas = tarefas com data de criação nesta semana." },
  fluxo: { what: "Onde as demandas estavam no fim de cada semana: na fila, em produção ou entregues.", how: "Para cada uma das últimas 8 semanas, olha o status que cada tarefa tinha no domingo à noite e conta por grupo. Na fila = antes de Pronto para criação. Em produção = Pronto, Criação, Revisão e Ajuste. Entregue = Para aprovação, Aprovado e Finalizado. Tarefas em Problema ficam de fora." },
  eficiencia: { what: "Quanto do tempo das demandas é trabalho de verdade e quanto é fila ou espera.", how: "Produzindo = Em criação + Revisão + Ajuste. Esperando = todas as etapas de fila e de aguardo. Percentual = produzindo ÷ (produzindo + esperando). Os tempos ao lado são a média por tarefa." },
  entrada: { what: "Se o time está fechando no mesmo ritmo em que recebe demanda.", how: "Por semana: Criadas = tarefas criadas naquela semana. Finalizadas = tarefas que entraram em “Finalizado” naquela semana. Linha roxa acima da verde por várias semanas = fila crescendo." },
  atraso: { what: "Há quantos dias as tarefas atrasadas estão vencidas.", how: "Para cada tarefa aberta e vencida: hoje − prazo, em dias de calendário. Depois agrupa em faixas de 1, 2–3, 4–7 e 8 ou mais dias." },
  gargalos: { what: "Em qual etapa as demandas de cada pessoa costumam ficar paradas. A cor mais forte é o gargalo.", how: "Cada célula é a média por tarefa: tempo que as tarefas ficaram naquele status enquanto estavam com a pessoa ÷ número de tarefas. Se a tarefa troca de responsável, o tempo é dividido no momento da troca. Voltas ao mesmo status somam. Finalizado e Problema não contam tempo." },
  velocidade: { what: "Quanto tempo, em média, uma demanda fica na mão de cada pessoa durante o ciclo criativo.", how: "O relógio corre de “Pronto para criação” até “Aprovado” ou “Finalizado”, religa se a tarefa volta para “Ajuste” e pausa se ela volta para texto ou captação. Só conta o período em que a tarefa estava atribuída à pessoa. Média = soma desse tempo ÷ número de entregas com ciclo fechado." },
  capacidade: { what: "Quem abre demanda e quem está com a carteira mais cheia.", how: "Criadas = tarefas que a pessoa cadastrou. Responsabilidades abertas = tarefas atribuídas a ela que ainda não estão em Finalizado nem em Problema." },
  previsibilidade: { what: "Em quanto tempo as tarefas costumam fechar, da criação à finalização.", how: "Para cada tarefa finalizada: entrada em “Finalizado” − criação. As barras contam quantas caíram em cada faixa. Mediana = metade fecha em até esse tempo. P85 = 85% fecham em até esse tempo." },
  promessa: { what: "Se as entregas acontecem na data combinada ou só depois de remarcar.", how: "Barra verde = finalizadas até a data original ÷ finalizadas com prazo. Barra azul = finalizadas até a data atual (já remarcada) ÷ finalizadas com prazo. A diferença entre as duas é o quanto o prazo precisou ser empurrado." },
  retrabalho: { what: "As demandas que mais tempo passaram em ajuste.", how: "Soma a duração de todas as passagens da tarefa pelo status “Ajuste”, incluindo a que estiver aberta agora. Ordenado do maior tempo para o menor." },
  colaboracao: { what: "As demandas que mais geraram conversa.", how: "Conta os comentários escritos por pessoas em cada tarefa. Registros automáticos de alteração não entram." },
  qualidade: { what: "Tarefas abertas que não conseguem avançar por falta de informação.", how: "Para cada tarefa aberta, verifica responsável, prazo, formato, canal e link do material. Vermelho = crítico (aprovação sem material). Mostra os 12 primeiros." },
  planejamento: { what: "Quais prazos foram mudados e quanto foram empurrados.", how: "Impacto = data atual − data original, em dias. Original é o prazo antes da primeira mudança registrada. Ordenado pelo maior deslocamento." },
  adocao: { what: "Quanto cada pessoa usa o sistema.", how: "Ações = tarefas criadas + alterações de campos + comentários escritos. Quem não tem nenhuma ação fica com a barra tracejada." },
  carteira: { what: "A situação das demandas de cada cliente.", how: "Progresso = finalizadas ÷ total. Atrasadas = abertas com prazo vencido. Retrabalho = tarefas que passaram por Ajuste. Avisos = inconsistências de informação. Prazo médio = média do tempo entre criação e finalização." },
} satisfies Record<string, { what: string; how: string }>;

type Tip = { content: React.ReactNode; x: number; y: number };

const TipContext = createContext<(tip: Tip | null) => void>(() => {});

/** Liga um elemento ao balão de detalhes da tela. No mouse o balão segue o
 * cursor; no toque ele abre no dedo e fica até a pessoa tocar fora ou rolar. */
function useTip() {
  const setTip = useContext(TipContext);
  return (content: React.ReactNode) => ({
    "data-dash-tip": "",
    onPointerEnter: (event: React.PointerEvent) => setTip({ content, x: event.clientX, y: event.clientY }),
    onPointerMove: (event: React.PointerEvent) => { if (event.pointerType !== "touch") setTip({ content, x: event.clientX, y: event.clientY }); },
    onPointerLeave: (event: React.PointerEvent) => { if (event.pointerType !== "touch") setTip(null); },
    onFocus: (event: React.FocusEvent) => { const box = event.currentTarget.getBoundingClientRect(); setTip({ content, x: box.left + box.width / 2, y: box.top }); },
    onBlur: () => setTip(null),
  });
}

function TipLayer({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  const x = Math.min(Math.max(tip.x, 156), Math.max(156, window.innerWidth - 156));
  return <div className={`dash-tip${tip.y < 190 ? " is-below" : ""}`} role="tooltip" style={{ left: x, top: tip.y }}>{tip.content}</div>;
}

function TipBody({ title, rows = [], note }: { title: string; rows?: [string, string | number][]; note?: string }) {
  return <><strong>{title}</strong>{rows.map(([label, value]) => <span key={label}><em>{label}</em><b>{value}</b></span>)}{note ? <small>{note}</small> : null}</>;
}

function InfoButton({ label, info }: { label: string; info: { what: string; how: string } }) {
  const tip = useTip();
  return <button type="button" className="dash-info" aria-label={`${label}. ${info.what} Como é calculado: ${info.how}`} {...tip(<><strong>O que mostra</strong><p>{info.what}</p><strong>Como é calculado</strong><p>{info.how}</p></>)}><Info size={14} /></button>;
}

function plural(count: number, one: string, many: string) { return `${count} ${count === 1 ? one : many}`; }

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

function KpiCard({ icon, tone, label, value, detail, info }: { icon: React.ReactNode; tone: string; label: string; value: string | number; detail: string; info: { what: string; how: string } }) {
  return <article className={`dash-kpi dash-kpi--${tone}`}><span className="dash-kpi__icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><InfoButton label={label} info={info} /></article>;
}

function PanelHead({ eyebrow, title, detail, info, action }: { eyebrow: string; title: string; detail: string; info: { what: string; how: string }; action?: React.ReactNode }) {
  return <header className="dash-panel-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}<InfoButton label={title} info={info} /></h2><p>{detail}</p></div>{action}</header>;
}

function ThroughputChart({ rows }: { rows: { label: string; created: number; completed: number }[] }) {
  const tip = useTip();
  const width = 720, height = 210, padX = 24, padY = 22;
  const maximum = Math.max(1, ...rows.flatMap((row) => [row.created, row.completed]));
  const step = (width - padX * 2) / Math.max(1, rows.length - 1);
  const point = (value: number, index: number) => ({ x: padX + index * step, y: height - padY - (value / maximum) * (height - padY * 2) });
  const line = (key: "created" | "completed") => rows.map((row, index) => { const { x, y } = point(row[key], index); return `${x},${y}`; }).join(" ");
  return <div className="dash-line-chart">
    <div className="dash-chart-legend"><span><i className="created" />Criadas</span><span><i className="completed" />Finalizadas</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tarefas criadas e finalizadas nas últimas oito semanas">
      {[0, .25, .5, .75, 1].map((portion) => <line key={portion} x1={padX} x2={width - padX} y1={padY + portion * (height - padY * 2)} y2={padY + portion * (height - padY * 2)} className="dash-chart-grid" />)}
      <polyline points={line("created")} className="dash-chart-line dash-chart-line--created" /><polyline points={line("completed")} className="dash-chart-line dash-chart-line--completed" />
      {rows.flatMap((row, index) => (["created", "completed"] as const).map((key) => { const { x, y } = point(row[key], index); return <circle key={`${key}:${index}`} cx={x} cy={y} r="4" className={`dash-chart-dot dash-chart-dot--${key}`} />; }))}
      {rows.map((row, index) => <rect key={index} x={padX + index * step - step / 2} y={0} width={step} height={height} className="dash-chart-band" {...tip(<TipBody title={`Semana de ${row.label}`} rows={[["Criadas", row.created], ["Finalizadas", row.completed], ["Saldo da fila", `${row.created - row.completed > 0 ? "+" : ""}${row.created - row.completed}`]]} />)} />)}
    </svg><div className="dash-chart-axis">{rows.map((row) => <span key={row.label}>{row.label}</span>)}</div>
  </div>;
}

function CumulativeFlowChart({ rows }: { rows: DashboardFlowPoint[] }) {
  const tip = useTip();
  const width = 720, height = 224, padX = 26, padY = 18;
  const maximum = Math.max(1, ...rows.map((row) => row.total));
  const step = (width - padX * 2) / Math.max(1, rows.length - 1);
  const x = (index: number) => padX + index * step;
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
      {FLOW_SERIES.map((series, index) => <path key={series.key} d={area(index)} fill={series.color} fillOpacity=".82" stroke={series.color} strokeWidth="1" />)}
      {rows.map((row, index) => <rect key={row.start} x={x(index) - step / 2} y={0} width={step} height={height} className="dash-chart-band" {...tip(<TipBody title={`Fim da semana · ${row.label}`} rows={[...FLOW_SERIES.toReversed().map((series): [string, number] => [series.label, row[series.key]]), ["Total", row.total]]} />)} />)}
    </svg><div className="dash-chart-axis">{rows.map((row) => <span key={row.start}>{row.label}</span>)}</div>
  </div>;
}

function FlowEfficiencyGauge({ flow, leadTime }: { flow: DashboardMetrics["flowEfficiency"]; leadTime: DashboardLeadTime }) {
  const tip = useTip();
  const circumference = 289, filled = (flow.ratio / 100) * circumference;
  const perTask = (ms: number) => formatDuration(flow.tasks ? ms / flow.tasks : 0);
  const detail = <TipBody title="Trabalhando × esperando" rows={[["Produzindo, por tarefa", perTask(flow.workingMs)], ["Esperando, por tarefa", perTask(flow.waitingMs)], ["Tarefas medidas", flow.tasks]]} note={`${flow.ratio}% do tempo aberto foi de produção.`} />;
  return <div className="dash-gauge">
    <div className="dash-donut" role="img" aria-label={`Eficiência de fluxo de ${flow.ratio}%`} {...tip(detail)}>
      <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" className="dash-donut__track" /><circle cx="60" cy="60" r="46" className="dash-donut__slice" stroke="var(--vz-brand)" strokeDasharray={`${filled} ${circumference - filled}`} /></svg>
      <div><strong>{flow.ratio}%</strong><span>com a mão na massa</span></div>
    </div>
    <ul className="dash-gauge__legend">
      <li {...tip(detail)}><i style={{ background: "var(--vz-brand)" }} /><span>Produzindo, por tarefa</span><strong>{perTask(flow.workingMs)}</strong></li>
      <li {...tip(detail)}><i style={{ background: "var(--vz-panel-muted)", border: "1px solid var(--vz-line)" }} /><span>Esperando, por tarefa</span><strong>{perTask(flow.waitingMs)}</strong></li>
      <li {...tip(<TipBody title="Prazo confiável (P85)" rows={[["Tarefas finalizadas medidas", leadTime.samples]]} note="85% das tarefas finalizadas fecharam em até esse tempo, da criação à finalização." />)}><i style={{ background: "var(--vz-green-solid)" }} /><span>Prazo confiável (P85)</span><strong>{leadTime.p85Ms === undefined ? "Sem base" : formatDuration(leadTime.p85Ms)}</strong></li>
    </ul>
  </div>;
}

function LeadTimeChart({ leadTime }: { leadTime: DashboardLeadTime }) {
  const tip = useTip();
  if (!leadTime.samples) return <EmptyMetric>Nenhuma tarefa finalizada com histórico para medir o prazo.</EmptyMetric>;
  const maximum = Math.max(1, ...leadTime.histogram.map((bucket) => bucket.count));
  return <div className="dash-histogram">
    <div className="dash-histogram__bars">{leadTime.histogram.map((bucket) => <div key={bucket.label} {...tip(<TipBody title={`Fecharam em ${bucket.label}`} rows={[["Tarefas", bucket.count], ["Do total finalizado", `${Math.round((bucket.count / leadTime.samples) * 100)}%`]]} />)}><i style={{ height: `${Math.max(3, (bucket.count / maximum) * 100)}%` }} /><b>{bucket.count}</b><span>{bucket.label}</span></div>)}</div>
    <div className="dash-histogram__marks">
      <div><span>Mediana</span><strong>{leadTime.p50Ms === undefined ? "—" : formatDuration(leadTime.p50Ms)}</strong><small>metade fecha em até isso</small></div>
      <div><span>P85</span><strong>{leadTime.p85Ms === undefined ? "—" : formatDuration(leadTime.p85Ms)}</strong><small>o prazo que dá pra prometer</small></div>
      <div><span>Base</span><strong>{leadTime.samples}</strong><small>tarefas finalizadas medidas</small></div>
    </div>
  </div>;
}

function PunctualityChart({ punctuality }: { punctuality: DashboardPunctuality }) {
  const tip = useTip();
  if (!punctuality.delivered) return <EmptyMetric>Ainda não há entregas fechadas com prazo definido.</EmptyMetric>;
  const rows = [
    { label: "Na data prometida no início", rate: punctuality.originalRate, count: punctuality.keptOriginal, tone: "original" },
    { label: "Na data depois de remarcar", rate: punctuality.currentRate, count: punctuality.keptCurrent, tone: "current" },
  ];
  return <div className="dash-punctuality">
    {rows.map((row) => <div className="dash-punctuality__row" key={row.tone} {...tip(<TipBody title={row.label} rows={[["No prazo", row.count], ["Fora do prazo", punctuality.delivered - row.count], ["Entregas com prazo", punctuality.delivered]]} note={`${row.count} ÷ ${punctuality.delivered} = ${row.rate}%`} />)}>
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
  const tip = useTip();
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const slices = buckets.map((bucket, index) => {
    const length = (total ? bucket.count / total : 0) * 289;
    const offset = buckets.slice(0, index).reduce((sum, previous) => sum + (total ? previous.count / total : 0) * 289, 0);
    return { ...bucket, length, offset };
  });
  const detail = (bucket: { label: string; count: number }) => <TipBody title={`Atrasadas há ${bucket.label}`} rows={[["Tarefas", bucket.count], ["Das atrasadas", `${total ? Math.round((bucket.count / total) * 100) : 0}%`]]} />;
  return <div className="dash-delay"><div className="dash-donut" role="img" aria-label={`${total} tarefas atrasadas`}><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" className="dash-donut__track" />{slices.map((bucket) => <circle key={bucket.label} cx="60" cy="60" r="46" className="dash-donut__slice" stroke={bucket.color} strokeDasharray={`${bucket.length} ${289 - bucket.length}`} strokeDashoffset={-bucket.offset} {...tip(detail(bucket))} />)}</svg><div><strong>{total}</strong><span>atrasadas</span></div></div><ul>{buckets.map((bucket) => <li key={bucket.label} {...tip(detail(bucket))}><i style={{ background: bucket.color }} /><span>{bucket.label}</span><strong>{bucket.count}</strong></li>)}</ul></div>;
}

function StatusHeatmap({ members }: { members: DashboardMemberMetric[] }) {
  const tip = useTip();
  const average = (member: DashboardMemberMetric, status: TaskStatus) => member.statusTasks[status] ? member.statusMs[status] / member.statusTasks[status] : 0;
  const maximum = Math.max(1, ...members.flatMap((member) => TIMED_STATUSES.map(({ value }) => average(member, value))));
  return <div className="dash-heatmap-wrap"><div className="dash-heatmap" style={{ "--dash-status-count": TIMED_STATUSES.length } as React.CSSProperties}>
    <div className="dash-heatmap__corner">Pessoa</div>{TIMED_STATUSES.map(({ value, label }) => <div className="dash-heatmap__status" title={label} key={value}>{STATUS_SHORT[value]}</div>)}<div className="dash-heatmap__status">Média/tarefa</div>
    {members.map((member) => <div className="dash-heatmap__row" key={member.memberId}><div className="dash-heatmap__person"><Avatar member={member} small /><span>{member.name}</span></div>{TIMED_STATUSES.map(({ value, label }) => {
      const duration = average(member, value); const count = member.statusTasks[value]; const alpha = duration ? .12 + (duration / maximum) * .76 : 0;
      return <div key={value} className="dash-heatmap__cell" style={{ background: duration ? `color-mix(in srgb, ${STATUS_COLORS[value]} ${Math.round(alpha * 100)}%, transparent)` : undefined }} {...tip(count
        ? <TipBody title={`${member.name} · ${label}`} rows={[["Média por tarefa", formatDuration(duration)], ["Tarefas que passaram aqui", count], ["A que mais demorou", formatDuration(member.statusMaxMs[value])]]} note={`${formatDuration(member.statusMs[value])} somados ÷ ${plural(count, "tarefa", "tarefas")}`} />
        : <TipBody title={`${member.name} · ${label}`} note="Nenhuma tarefa passou por este status enquanto estava com a pessoa." />)}>{count ? formatDuration(duration) : "—"}</div>;
    })}<div className="dash-heatmap__total" {...tip(<TipBody title={`${member.name} · todas as etapas`} rows={[["Média por tarefa", member.timedTasks ? formatDuration(member.totalStatusMs / member.timedTasks) : "—"], ["Tarefas medidas", member.timedTasks], ["Produzindo", formatDuration(member.workingMs)], ["Esperando", formatDuration(member.waitingMs)]]} note="Tempo médio que uma tarefa passa aberta sob a responsabilidade da pessoa." />)}>{member.timedTasks ? formatDuration(member.totalStatusMs / member.timedTasks) : "—"}</div></div>)}
  </div></div>;
}

function SpeedChart({ members }: { members: DashboardMemberMetric[] }) {
  const tip = useTip();
  const rows = members.filter((member) => member.creativeAverageMs !== undefined).sort((a, b) => (b.creativeAverageMs || 0) - (a.creativeAverageMs || 0)); const maximum = rows[0]?.creativeAverageMs || 1;
  if (!rows.length) return <EmptyMetric>O histórico ainda não tem ciclos criativos concluídos.</EmptyMetric>;
  return <div className="dash-bars">{rows.map((member, index) => <div className={`dash-bar-row${index === 0 ? " is-alert" : ""}`} key={member.memberId} {...tip(<TipBody title={member.name} rows={[["Média por entrega", formatDuration(member.creativeAverageMs || 0)], ["Entregas medidas", member.creativeDeliveries], ["Tempo somado", formatDuration((member.creativeAverageMs || 0) * member.creativeDeliveries)]]} note="Conta só o período em que a tarefa estava com a pessoa, de Pronto para criação até Aprovado ou Finalizado." />)}><div className="dash-bar-label"><Avatar member={member} small /><span><strong>{member.name}</strong><small>{member.creativeDeliveries} {member.creativeDeliveries === 1 ? "entrega medida" : "entregas medidas"}</small></span></div><div className="dash-bar-track"><i style={{ width: `${Math.max(4, ((member.creativeAverageMs || 0) / maximum) * 100)}%` }} /></div><strong>{formatDuration(member.creativeAverageMs || 0)}</strong></div>)}</div>;
}

function BalanceChart({ members }: { members: DashboardMemberMetric[] }) {
  const tip = useTip();
  const maximum = Math.max(1, ...members.flatMap((member) => [member.created, member.openTasks]));
  return <div className="dash-balance"><div className="dash-balance__labels"><span>Tarefas criadas</span><span>Responsabilidades abertas</span></div>{members.map((member) => <div className="dash-balance__row" key={member.memberId} {...tip(<TipBody title={member.name} rows={[["Tarefas criadas", member.created], ["Responsabilidades abertas", member.openTasks]]} />)}><div className="dash-balance__left"><strong>{member.created}</strong><i style={{ width: `${(member.created / maximum) * 100}%` }} /></div><div className="dash-balance__member"><Avatar member={member} small /><span>{member.name}</span></div><div className="dash-balance__right"><i style={{ width: `${(member.openTasks / maximum) * 100}%` }} /><strong>{member.openTasks}</strong></div></div>)}<p className="dash-footnote">“Criadas” passa a ser registrado a partir desta versão; tarefas antigas permanecem sem autoria.</p></div>;
}

function ActivityChart({ members }: { members: DashboardMemberMetric[] }) {
  const tip = useTip();
  const rows = [...members].sort((a, b) => b.totalActivity - a.totalActivity); const maximum = Math.max(1, ...rows.map((member) => member.totalActivity));
  return <div className="dash-activity"><div className="dash-chart-legend"><span><i className="activity-created" />Criações</span><span><i className="activity-change" />Alterações</span><span><i className="activity-comment" />Comentários</span></div>{rows.map((member) => <div className={`dash-activity__row${member.totalActivity ? "" : " is-idle"}`} key={member.memberId} {...tip(<TipBody title={member.name} rows={[["Criações", member.created], ["Alterações", member.changes], ["Comentários", member.comments], ["Total de ações", member.totalActivity]]} />)}><div><Avatar member={member} small /><span>{member.name}</span></div><div className="dash-activity__track"><i className="activity-created" style={{ width: `${(member.created / maximum) * 100}%` }} /><i className="activity-change" style={{ width: `${(member.changes / maximum) * 100}%` }} /><i className="activity-comment" style={{ width: `${(member.comments / maximum) * 100}%` }} /></div><strong>{member.totalActivity}</strong></div>)}</div>;
}

export function DashboardView({ metrics }: DashboardViewProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    // No toque não existe "sair" do elemento: o balão fecha quando a pessoa
    // toca em outro lugar ou rola a tela.
    const dismiss = (event: Event) => { if (!(event.target instanceof Element) || !event.target.closest("[data-dash-tip]")) setTip(null); };
    const close = () => setTip(null);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", close, true);
    return () => { document.removeEventListener("pointerdown", dismiss); window.removeEventListener("scroll", close, true); };
  }, []);
  const activeMembers = metrics.members;
  const maxComments = Math.max(1, ...metrics.topCommented.map((task) => task.count));
  const lastWeek = metrics.throughput.at(-1);
  const flow = metrics.flowEfficiency;
  return <TipContext.Provider value={setTip}><main className="admin-page dashboard dashboard-intelligence">
    <div className="dashboard-head dashboard-head--intelligence"><div><span className="eyebrow">Inteligência operacional</span><h1>Pulso da operação</h1><p>Gargalos, capacidade, retrabalho e qualidade do planejamento calculados a partir do histórico real das tarefas.</p></div><span className="dash-live"><i /> Dados atualizados ao abrir</span></div>

    <section className="dash-kpi-grid" aria-label="Indicadores principais">
      <KpiCard icon={<Clock3 size={19} />} tone="violet" label="Ciclo criativo médio" value={metrics.averageCreativeMs === undefined ? "Sem base" : formatDuration(metrics.averageCreativeMs)} detail={`${metrics.creativeDeliveries} entregas com ciclo completo`} info={INFO.kpiCiclo} />
      <KpiCard icon={<Gauge size={19} />} tone="blue" label="Eficiência de fluxo" value={`${flow.ratio}%`} detail={`${formatDuration(flow.tasks ? flow.waitingMs / flow.tasks : 0)} de espera por tarefa, em média`} info={INFO.kpiEficiencia} />
      <KpiCard icon={<Target size={19} />} tone="green" label="Entrega na data prometida" value={`${metrics.punctuality.originalRate}%`} detail={`${metrics.punctuality.keptOriginal} de ${metrics.punctuality.delivered} entregas fecharam no prazo original`} info={INFO.kpiPontualidade} />
      <KpiCard icon={<Hourglass size={19} />} tone="violet" label="Prazo confiável (P85)" value={metrics.leadTime.p85Ms === undefined ? "Sem base" : formatDuration(metrics.leadTime.p85Ms)} detail={`85% das ${metrics.leadTime.samples} tarefas medidas fecham até aí`} info={INFO.kpiP85} />
      <KpiCard icon={<RefreshCcw size={19} />} tone="amber" label="Taxa de retrabalho" value={`${metrics.reworkRate}%`} detail={`${metrics.reworkedTasks} de ${metrics.creativeTasks} tarefas que entraram em criação passaram por ajuste`} info={INFO.kpiRetrabalho} />
      <KpiCard icon={<CalendarClock size={19} />} tone="red" label="Atrasos ativos" value={metrics.overdueTasks} detail={`de ${metrics.activeTasks} responsabilidades abertas`} info={INFO.kpiAtrasos} />
      <KpiCard icon={<FileWarning size={19} />} tone="blue" label="Bloqueios de informação" value={metrics.criticalAlerts} detail={`${metrics.alerts.length} inconsistências no total`} info={INFO.kpiBloqueios} />
      <KpiCard icon={<TrendingUp size={19} />} tone="green" label="Entregas na semana" value={lastWeek?.completed ?? 0} detail={`${lastWeek?.created ?? 0} tarefas criadas no mesmo período`} info={INFO.kpiSemana} />
    </section>

    <section className="dash-insight-strip" aria-label="Destaques da operação">
      <div><Sparkles size={18} /><span>Maior tempo criativo</span><strong>{metrics.slowestCreative?.name || "Sem base"}</strong><small>{metrics.slowestCreative?.creativeAverageMs ? `${formatDuration(metrics.slowestCreative.creativeAverageMs)} em média` : "aguardando ciclos completos"}</small></div>
      <div><UsersRound size={18} /><span>Maior carga aberta</span><strong>{metrics.mostLoaded?.name || "Sem equipe"}</strong><small>{metrics.mostLoaded ? `${metrics.mostLoaded.openTasks} responsabilidades` : "—"}</small></div>
      <div><UserRoundCheck size={18} /><span>Mais atividade registrada</span><strong>{metrics.mostActive?.name || "Sem equipe"}</strong><small>{metrics.mostActive ? `${metrics.mostActive.totalActivity} ações` : "—"}</small></div>
      <div><UserRoundX size={18} /><span>Sem nenhuma atividade</span><strong>{metrics.idleMembers.length ? metrics.idleMembers.map((member) => member.name).join(", ") : "Ninguém parado"}</strong><small>{metrics.idleMembers.length ? `${metrics.idleMembers.length} de ${activeMembers.length} pessoas sem ação e sem carteira` : "todo mundo com ação registrada"}</small></div>
    </section>

    <div className="dash-grid dash-grid--wide-left">
      <section className="panel dash-panel"><PanelHead eyebrow="Fluxo" title="Fila, produção e entrega semana a semana" detail="Faixa que engrossa é fila que se acumula. Quando a de produção incha sem a verde subir, o time está começando mais do que termina." info={INFO.fluxo} /><CumulativeFlowChart rows={metrics.cumulativeFlow} /></section>
      <section className="panel dash-panel"><PanelHead eyebrow="Eficiência" title="Trabalhando × esperando" detail="Quanto do tempo das demandas abertas alguém estava de fato produzindo." info={INFO.eficiencia} /><FlowEfficiencyGauge flow={flow} leadTime={metrics.leadTime} /></section>
    </div>

    <div className="dash-grid dash-grid--wide-left">
      <section className="panel dash-panel"><PanelHead eyebrow="Fluxo" title="Entrada × entrega" detail="Tarefas criadas e efetivamente finalizadas por semana, nas últimas 8 semanas." info={INFO.entrada} /><ThroughputChart rows={metrics.throughput} /></section>
      <section className="panel dash-panel"><PanelHead eyebrow="Atrasos" title="Gravidade do atraso" detail="Distribuição das tarefas abertas que já passaram do prazo." info={INFO.atraso} /><DelayChart buckets={metrics.delayBuckets} /></section>
    </div>

    <section className="panel dash-panel dash-panel--full"><PanelHead eyebrow="Gargalos" title="Tempo médio por tarefa em cada status" detail="Quanto tempo, em média, uma tarefa fica em cada etapa enquanto está com a pessoa. Passe o cursor ou toque na célula para ver quantas tarefas e a soma." info={INFO.gargalos} />{activeMembers.length ? <StatusHeatmap members={activeMembers} /> : <EmptyMetric>Nenhum membro ativo encontrado.</EmptyMetric>}</section>

    <div className="dash-grid">
      <section className="panel dash-panel"><PanelHead eyebrow="Velocidade" title="Tempo médio de criação até a aprovação" detail="De “Pronto para criação” até “Aprovado” ou “Finalizado”, somando as voltas para ajuste. Barras maiores indicam um ciclo mais lento." info={INFO.velocidade} /><SpeedChart members={activeMembers} /></section>
      <section className="panel dash-panel"><PanelHead eyebrow="Capacidade" title="Criação × responsabilidade" detail="Compara quem organiza o trabalho com quem concentra a carteira aberta." info={INFO.capacidade} /><BalanceChart members={activeMembers} /></section>
    </div>

    <div className="dash-grid">
      <section className="panel dash-panel"><PanelHead eyebrow="Previsibilidade" title="Quanto tempo uma tarefa leva para fechar" detail="Distribuição do prazo real entre a criação e o fechamento das tarefas já finalizadas." info={INFO.previsibilidade} /><LeadTimeChart leadTime={metrics.leadTime} /></section>
      <section className="panel dash-panel"><PanelHead eyebrow="Promessa" title="A data combinada se sustentou?" detail="Compara a entrega com a data prometida no início e com a data já remarcada." info={INFO.promessa} /><PunctualityChart punctuality={metrics.punctuality} /></section>
    </div>

    <div className="dash-grid">
      <section className="panel dash-panel"><PanelHead eyebrow="Retrabalho" title="Tarefas que mais ficaram em ajuste" detail="Soma todas as entradas em Ajuste, incluindo retornos repetidos." info={INFO.retrabalho} />{metrics.reworkTasks.length ? <div className="dash-task-ranking">{metrics.reworkTasks.map((task, index) => <Link href={`/tarefas/${task.id}`} key={task.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{task.name}</strong><small>{task.projectName}</small></div><div><strong>{formatDuration(task.totalMs || 0)}</strong><small>{task.visits}× em ajuste</small></div><ArrowRight size={15} /></Link>)}</div> : <EmptyMetric>Nenhuma tarefa passou por Ajuste.</EmptyMetric>}</section>
      <section className="panel dash-panel"><PanelHead eyebrow="Colaboração" title="Tarefas com mais comentários" detail="Conversas humanas; alterações automáticas do histórico não entram nessa contagem." info={INFO.colaboracao} />{metrics.topCommented.length ? <div className="dash-comment-ranking">{metrics.topCommented.map((task) => <Link href={`/tarefas/${task.id}`} key={task.id}><div><MessageSquareText size={15} /><span><strong>{task.name}</strong><small>{task.projectName}</small></span><b>{task.count}</b></div><i><span style={{ width: `${(task.count / maxComments) * 100}%` }} /></i></Link>)}</div> : <EmptyMetric>Ainda não há comentários nas tarefas.</EmptyMetric>}</section>
    </div>

    <section className="panel dash-panel dash-panel--full"><PanelHead eyebrow="Qualidade da operação" title="Informações que bloqueiam a próxima etapa" detail="O mesmo aviso aparece dentro da tarefa para quem está com ela na mão: aprovação sem material é crítica." info={INFO.qualidade} action={<Link className="secondary-button" href="/tarefas">Abrir tarefas</Link>} />{metrics.alerts.length ? <div className="dash-alert-grid">{metrics.alerts.slice(0, 12).map((alert) => <Link href={`/tarefas/${alert.taskId}`} className={alert.critical ? "is-critical" : ""} key={alert.id}><span>{alert.critical ? <AlertTriangle size={16} /> : <FileWarning size={16} />}</span><div><strong>{alert.label}</strong><b>{alert.taskName}</b><small>{alert.projectName}</small></div><ArrowRight size={15} /></Link>)}</div> : <div className="dash-success"><CheckCircle2 size={21} /><div><strong>Nenhum bloqueio encontrado</strong><span>As tarefas abertas têm as informações essenciais para avançar.</span></div></div>}</section>

    <div className="dash-grid dash-grid--wide-right">
      <section className="panel dash-panel"><PanelHead eyebrow="Planejamento" title="Datas que foram reprogramadas" detail="Preserva o prazo original, o prazo atual e a data real de fechamento." info={INFO.planejamento} />{metrics.reschedules.length ? <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Tarefa</th><th>Original</th><th>Atual</th><th>Fechada</th><th>Impacto</th></tr></thead><tbody>{metrics.reschedules.slice(0, 10).map((row) => <tr key={row.id}><td><Link href={`/tarefas/${row.taskId}`}><strong>{row.taskName}</strong><span>{row.projectName}</span></Link></td><td>{formatDueDate(row.originalDate)}</td><td>{formatDueDate(row.currentDate)}</td><td>{row.completedDate ? formatDueDate(row.completedDate) : "Aberta"}</td><td><strong className={row.movedDays > 0 ? "is-negative" : "is-positive"}>{row.movedDays > 0 ? `+${row.movedDays}` : row.movedDays}d</strong><span>{row.changes} {row.changes === 1 ? "mudança" : "mudanças"}</span></td></tr>)}</tbody></table></div> : <EmptyMetric>Nenhuma mudança de prazo registrada.</EmptyMetric>}</section>
      <section className="panel dash-panel"><PanelHead eyebrow="Adoção" title="Atividade dentro do sistema" detail="Criações, alterações de campos e comentários. Quem não registrou nada fica marcado." info={INFO.adocao} /><ActivityChart members={activeMembers} /></section>
    </div>

    <section className="panel dash-panel dash-panel--full"><PanelHead eyebrow="Carteira" title="Saúde por cliente" detail="Ordenado por atraso: o cliente do topo é o que precisa de decisão hoje." info={INFO.carteira} action={<Link className="secondary-button" href="/projetos">Ver projetos</Link>} /><ProjectHealthTable rows={metrics.projectHealth} /></section>
    <TipLayer tip={tip} />
  </main></TipContext.Provider>;
}
