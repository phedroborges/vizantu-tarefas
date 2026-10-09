import { AUTO_APPROVAL_REVIEWER } from "./approval-workflow";
import { isoDateInSaoPaulo, overdueDays, summarizeStatusDurations } from "./dates";
import { isUserComment } from "./task-activity";
import { findTaskGaps, type TaskGapType } from "./task-readiness";
import {
  CLOSED_TASK_STATUSES,
  TASK_STATUSES,
  type Member,
  type PlanApprovalEvent,
  type Project,
  type StatusGroup,
  type Tag,
  type Task,
  type TaskStatus,
  type UserRole,
} from "./types";

const DAY = 86_400_000;
// O Brasil não tem mais horário de verão: São Paulo é UTC-3 o ano inteiro.
const SP_OFFSET = 3 * 3_600_000;

// A demanda passa por três fases. Estratégia é tudo antes de "Pronto para
// criação": o plano, o texto e a aprovação dele. Criação vai de "Pronto para
// criação" até o cliente aprovar a peça. Depois de aprovada ela volta para a
// estratégia, que entrega e posta.
export type DashboardPhaseKey = "estrategia" | "criacao" | "entrega";
const PHASE_BY_STATUS: Partial<Record<TaskStatus, DashboardPhaseKey>> = {
  rascunho: "estrategia", aguardando_informacao: "estrategia", aprovacao_copy: "estrategia", aguardando_captacao: "estrategia",
  pronto_para_criacao: "criacao", em_criacao: "criacao", revisao: "criacao", ajuste: "criacao", para_aprovacao: "criacao",
  aprovado: "entrega",
};
const PHASE_LABELS: Record<DashboardPhaseKey, string> = {
  estrategia: "Estratégia, antes da criação",
  criacao: "Criação",
  entrega: "Estratégia, entrega e postagem",
};

// Cada pessoa é medida pela fase em que trabalha. Diretor criativo responde
// pela criação; dono, gestor e social media respondem pela estratégia. Comparar
// os dois grupos na mesma régua pune quem planeja por um tempo que não é de
// produção.
export type DashboardArea = "estrategia" | "criacao";
export function areaOfRole(role: UserRole): DashboardArea {
  return role === "diretor_criativo" ? "criacao" : "estrategia";
}

// Nesses dois status a demanda está na mão do cliente: o texto do plano
// (estratégia) ou a peça pronta (criação). É tempo que o time não controla,
// então não entra na conta de ninguém — é medido à parte.
const CLIENT_STATUSES = new Set<TaskStatus>(["aprovacao_copy", "para_aprovacao"]);

// Relógio do ciclo criativo: liga quando a demanda entra em "Pronto para
// criação" (ou em qualquer etapa de produção) e corre só enquanto ela está com
// o time. Em "Para aprovação" ele pausa, porque quem demora ali é o cliente.
// Se a demanda volta para Ajuste, liga de novo e soma. O ciclo fecha em
// Aprovado ou Finalizado. Voltar para uma etapa anterior à criação (texto,
// captação) também pausa o relógio.
const CREATIVE_START = new Set<TaskStatus>(["pronto_para_criacao", "em_criacao", "revisao", "ajuste"]);
const CREATIVE_OPEN = new Set<TaskStatus>([...CREATIVE_START, "para_aprovacao"]);
const CREATIVE_STOP = new Set<TaskStatus>(["aprovado", "finalizado"]);

// Finalizado e Problema encerram a demanda. A entrada aberta desses status
// nunca fecha — contar o tempo dela faria toda tarefa entregue "envelhecer"
// para sempre na conta de quem a entregou.
const TERMINAL_STATUSES = new Set<TaskStatus>(CLOSED_TASK_STATUSES);
export const TIMED_STATUSES = TASK_STATUSES.filter(({ value }) => !TERMINAL_STATUSES.has(value));

// Eficiência de fluxo: das horas que a demanda passou sob nossa
// responsabilidade, quantas alguém estava de fato com a mão nela. A espera
// pelo cliente fica fora da conta (ver CLIENT_STATUSES).
const WORKING_STATUSES = new Set<TaskStatus>(["em_criacao", "revisao", "ajuste"]);
const WAITING_STATUSES = new Set<TaskStatus>(["rascunho", "aguardando_informacao", "aguardando_captacao", "pronto_para_criacao"]);

const GROUP_BY_STATUS = new Map<TaskStatus, StatusGroup>(TASK_STATUSES.map(({ value, group }) => [value, group]));

function timestamp(value?: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function calendarDays(from?: string, to?: string): number {
  if (!from || !to) return 0;
  const [fy, fm, fd] = from.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = to.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY);
}

type Interval = { status: TaskStatus; start: number; end: number };

/** Linha do tempo da tarefa em intervalos contíguos e ordenados. Conserta o
 * que o histórico gravado não garante: tarefa sem histórico nenhum, e status
 * trocado direto no banco, que deixa a entrada aberta apontando para um status
 * que a tarefa já não tem (nesse caso a troca é datada pelo updatedAt). */
function timeline(task: Task, nowMs: number): Interval[] {
  const entries = task.statusHistory
    .map((entry) => ({ status: entry.status, start: timestamp(entry.enteredAt), exit: timestamp(entry.exitedAt) }))
    .filter((entry): entry is { status: TaskStatus; start: number; exit: number | undefined } => entry.start !== undefined && entry.start <= nowMs)
    .sort((a, b) => a.start - b.start);
  const intervals: Interval[] = entries.map((entry, index) => {
    const next = entries[index + 1]?.start;
    const end = next === undefined ? entry.exit ?? nowMs : Math.min(entry.exit ?? next, next);
    return { status: entry.status, start: entry.start, end: Math.max(entry.start, Math.min(end, nowMs)) };
  });
  const last = intervals.at(-1);
  if (!last) {
    const created = timestamp(task.createdAt);
    return created === undefined ? [] : [{ status: task.status, start: Math.min(created, nowMs), end: nowMs }];
  }
  if (last.status !== task.status) {
    const changed = Math.max(last.start, Math.min(timestamp(task.updatedAt) ?? nowMs, nowMs));
    last.end = changed;
    intervals.push({ status: task.status, start: changed, end: nowMs });
  }
  return intervals;
}

function percentile(values: number[], fraction: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
}

function assigneeChanges(task: Task) {
  return task.comments
    .filter((comment) => comment.kind === "activity" && comment.fieldKey === "assigneeId")
    .map((comment) => ({ at: timestamp(comment.createdAt) || 0, oldValue: comment.oldValue }))
    .sort((a, b) => a.at - b.at);
}

function dueDateChanges(task: Task) {
  return task.comments
    .filter((comment) => comment.kind === "activity" && comment.fieldKey === "dueDate")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** A data prometida na primeira vez. É contra ela que se mede se o
 * planejamento se sustentou, e não contra a data já remarcada. */
function originalDueDate(task: Task): string | undefined {
  const changes = dueDateChanges(task);
  const first = changes[0];
  if (first && typeof first.oldValue === "string" && first.oldValue) return first.oldValue.slice(0, 10);
  return task.dueDate;
}

/** Reconstrói quem era o responsável em um instante passado. Partimos do
 * responsável atual e desfazemos, de trás para frente, as trocas posteriores
 * ao instante consultado. Assim uma mudança de pessoa não transfere para ela
 * todo o tempo histórico da tarefa. */
function assigneeAt(task: Task, at: number): string | undefined {
  let assignee = task.assigneeId;
  for (const change of assigneeChanges(task).toReversed()) {
    if (change.at <= at) continue;
    assignee = typeof change.oldValue === "string" && change.oldValue ? change.oldValue : undefined;
  }
  return assignee;
}

/** Segunda-feira 00:00 de São Paulo da semana que contém o instante. */
function weekStart(ms: number): number {
  const local = new Date(ms - SP_OFFSET);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return day - ((local.getUTCDay() + 6) % 7) * DAY + SP_OFFSET;
}

/** 00:00 de São Paulo do dia que contém o instante. */
function dayStart(ms: number): number {
  const local = new Date(ms - SP_OFFSET);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + SP_OFFSET;
}

/** Dia 1º, 00:00 de São Paulo, do mês que contém o instante (ou de meses adiante). */
function monthStart(ms: number, shift = 0): number {
  const local = new Date(ms - SP_OFFSET);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + shift, 1) + SP_OFFSET;
}

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const shortMonthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "America/Sao_Paulo" });

function shortDate(ms: number): string {
  return shortDateFormatter.format(new Date(ms)).replace(".", "");
}

export type DashboardBucketUnit = "dia" | "semana" | "mes";
type ChartBucket = { startMs: number; endMs: number; label: string };

/** As colunas dos gráficos de fluxo. Sem período, as últimas 8 semanas. Com
 * período, o grão acompanha o tamanho dele: dia até um mês, semana até um
 * semestre, mês daí em diante. Período curto ganha os 7 dias até o fim dele,
 * porque um ponto sozinho não desenha tendência nenhuma. */
function chartBuckets(fromMs: number, nowMs: number): { unit: DashboardBucketUnit; buckets: ChartBucket[] } {
  const weekly = (firstMs: number) => {
    const buckets: ChartBucket[] = [];
    for (let startMs = firstMs; startMs <= nowMs; startMs += 7 * DAY) buckets.push({ startMs, endMs: startMs + 7 * DAY, label: shortDate(startMs) });
    return { unit: "semana" as const, buckets };
  };
  if (fromMs === -Infinity) return weekly(weekStart(nowMs) - 7 * 7 * DAY);
  const span = nowMs - fromMs;
  if (span <= 31 * DAY) {
    const buckets: ChartBucket[] = [];
    for (let startMs = Math.min(dayStart(fromMs), dayStart(nowMs) - 6 * DAY); startMs <= nowMs; startMs += DAY) buckets.push({ startMs, endMs: startMs + DAY, label: shortDate(startMs) });
    return { unit: "dia", buckets };
  }
  if (span <= 182 * DAY) return weekly(weekStart(fromMs));
  const buckets: ChartBucket[] = [];
  for (let startMs = monthStart(fromMs); startMs <= nowMs; startMs = monthStart(startMs, 1)) {
    buckets.push({ startMs, endMs: monthStart(startMs, 1), label: shortMonthFormatter.format(new Date(startMs)).replace(".", "").replace(" de ", "/") });
  }
  return { unit: "mes", buckets };
}

export type DashboardMemberMetric = {
  memberId: string;
  name: string;
  area: DashboardArea;
  avatarUrl?: string | null;
  openTasks: number;
  created: number;
  comments: number;
  changes: number;
  totalActivity: number;
  /** Soma do tempo das tarefas em cada status enquanto estavam com a pessoa. */
  statusMs: Record<TaskStatus, number>;
  /** Quantas tarefas diferentes compõem a soma de cada status. */
  statusTasks: Record<TaskStatus, number>;
  /** A tarefa que mais tempo ficou em cada status. */
  statusMaxMs: Record<TaskStatus, number>;
  /** Tempo sob a responsabilidade da pessoa, sem a espera pelo cliente. */
  totalStatusMs: number;
  /** Tarefas diferentes com tempo medido sob a responsabilidade da pessoa. */
  timedTasks: number;
  workingMs: number;
  waitingMs: number;
  /** Tempo em que as tarefas da pessoa ficaram aguardando o cliente. */
  clientMs: number;
  creativeAverageMs?: number;
  /** Quanto as entregas da pessoa esperaram pela aprovação do cliente. */
  creativeClientAverageMs?: number;
  creativeDeliveries: number;
  /** Média por tarefa nas etapas de estratégia enquanto estava com a pessoa. */
  strategyAverageMs?: number;
  /** Média por tarefa esperando o cliente aprovar o texto. */
  strategyClientAverageMs?: number;
  /** Tarefas que passaram por etapa de estratégia com a pessoa. */
  strategyTasks: number;
};

/** Espera pelo cliente em uma das duas aprovações. */
export type DashboardClientStage = {
  /** Tarefas que passaram pela aprovação, incluindo as que estão nela agora. */
  tasks: number;
  totalMs: number;
  averageMs?: number;
  /** Quantas vezes as tarefas foram enviadas para aprovar. */
  rounds: number;
  waitingNow: number;
  /** A tarefa que está há mais tempo esperando resposta. */
  longestWaitingMs: number;
};

export type DashboardClientWait = { id: string; name: string; text: DashboardClientStage; creative: DashboardClientStage };

/** O que os clientes fizeram pelo link de aprovação. */
export type DashboardClientActivity = {
  events: Pick<PlanApprovalEvent, "taskId" | "action" | "comment" | "reviewerName" | "createdAt">[];
  links: { projectId: string; lastUsedAt?: string }[];
};

type DashboardClientResponses = {
  /** Respostas dadas pelo link: aprovações, pedidos de ajuste e recusas. */
  actions: number;
  approvals: number;
  /** Pedidos de ajuste e recusas. */
  changes: number;
  /** Respostas que vieram com comentário escrito. */
  comments: number;
  lastActionDate?: string;
};

export type DashboardClientAdoption = DashboardClientResponses & {
  id: string;
  name: string;
  /** Pessoas diferentes do cliente que já responderam. */
  reviewers: number;
  lastAccessDate?: string;
};

export type DashboardReviewer = DashboardClientResponses & { key: string; name: string; projectName: string };

export type DashboardPhase = {
  key: DashboardPhaseKey;
  label: string;
  /** Tarefas que passaram pela fase. */
  tasks: number;
  /** Média por tarefa com o time. */
  teamMs: number;
  /** Média por tarefa aguardando o cliente. */
  clientMs: number;
};

export type DashboardTaskMetric = {
  id: string;
  name: string;
  projectName: string;
  count: number;
  totalMs?: number;
  visits?: number;
};

export type DashboardDataAlert = {
  id: string;
  taskId: string;
  taskName: string;
  projectName: string;
  type: TaskGapType;
  label: string;
  message: string;
  critical: boolean;
};

export type DashboardReschedule = {
  id: string;
  taskId: string;
  taskName: string;
  projectName: string;
  originalDate?: string;
  currentDate?: string;
  completedDate?: string;
  changes: number;
  movedDays: number;
};

export type DashboardFlowPoint = {
  label: string;
  start: string;
  nao_iniciada: number;
  em_andamento: number;
  feita: number;
  total: number;
};

export type DashboardLeadTime = {
  samples: number;
  p50Ms?: number;
  p85Ms?: number;
  averageMs?: number;
  histogram: { label: string; count: number }[];
};

export type DashboardPunctuality = {
  delivered: number;
  keptCurrent: number;
  keptOriginal: number;
  currentRate: number;
  originalRate: number;
  averageSlipDays: number;
};

export type DashboardProjectHealth = {
  id: string;
  name: string;
  total: number;
  done: number;
  open: number;
  overdue: number;
  rework: number;
  alerts: number;
  progress: number;
  leadTimeMs?: number;
};

export type DashboardMetrics = {
  generatedAt: string;
  totalTasks: number;
  activeTasks: number;
  overdueTasks: number;
  reworkRate: number;
  reworkedTasks: number;
  averageCreativeMs?: number;
  /** Média, por entrega, da espera pela aprovação da peça. */
  averageCreativeClientMs?: number;
  creativeDeliveries: number;
  clientWait: { text: DashboardClientStage; creative: DashboardClientStage; projects: DashboardClientWait[] };
  /** Clientes com link de aprovação, do que mais usa para o que menos usa. */
  clientAdoption: DashboardClientAdoption[];
  /** As pessoas dos clientes que mais responderam pelo link. */
  reviewers: DashboardReviewer[];
  phases: DashboardPhase[];
  /** Tarefas que chegaram a entrar na criação: a base da taxa de retrabalho. */
  creativeTasks: number;
  criticalAlerts: number;
  flowEfficiency: { workingMs: number; waitingMs: number; clientMs: number; ratio: number; tasks: number };
  leadTime: DashboardLeadTime;
  punctuality: DashboardPunctuality;
  members: DashboardMemberMetric[];
  slowestCreative?: DashboardMemberMetric;
  mostLoaded?: DashboardMemberMetric;
  mostActive?: DashboardMemberMetric;
  idleMembers: DashboardMemberMetric[];
  topCommented: DashboardTaskMetric[];
  reworkTasks: DashboardTaskMetric[];
  alerts: DashboardDataAlert[];
  reschedules: DashboardReschedule[];
  delayBuckets: { label: string; count: number; color: string }[];
  /** Tarefas criadas e finalizadas dentro do período. */
  periodTotals: { created: number; completed: number };
  /** O grão das colunas dos gráficos de fluxo. */
  bucketUnit: DashboardBucketUnit;
  throughput: { label: string; start: string; created: number; completed: number }[];
  cumulativeFlow: DashboardFlowPoint[];
  projectHealth: DashboardProjectHealth[];
};

export function buildDashboardMetrics({
  tasks,
  projects,
  members,
  tags,
  clientActivity,
  nowIso,
  fromIso,
}: {
  tasks: Task[];
  projects: Project[];
  members: Member[];
  tags: Tag[];
  clientActivity?: DashboardClientActivity;
  nowIso: string;
  /** Início do período. Sem ele, entra o histórico inteiro. */
  fromIso?: string;
}): DashboardMetrics {
  const nowMs = new Date(nowIso).getTime();
  // O período recorta de três jeitos. Tempo em status: só conta a parte que
  // caiu dentro dele. Acontecimentos (criação, entrega, comentário, resposta
  // do cliente): só os que aconteceram nele. Situação (carga aberta, atrasos,
  // bloqueios): a fotografia do fim dele.
  const fromMs = timestamp(fromIso) ?? -Infinity;
  const inWindow = (value?: number) => value === undefined ? fromMs === -Infinity : value >= fromMs;
  const today = isoDateInSaoPaulo(nowMs);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const activeMembers = members.filter((member) => member.active);
  const timelines = new Map(tasks.map((task) => [task.id, timeline(task, nowMs)]));
  const completedAt = (task: Task) => timelines.get(task.id)!.find((interval) => interval.status === "finalizado")?.start;
  /** Quando a tarefa começou a existir para o time: o primeiro registro de
   * status, ou a criação, o que vier antes. */
  const startedAt = (task: Task) => {
    const created = timestamp(task.createdAt);
    const entered = timelines.get(task.id)![0]?.start;
    if (entered === undefined) return created;
    return created === undefined ? entered : Math.min(created, entered);
  };
  const zeroByStatus = () => Object.fromEntries(TASK_STATUSES.map(({ value }) => [value, 0])) as Record<TaskStatus, number>;

  const memberMetrics = new Map<string, DashboardMemberMetric>(activeMembers.map((member) => [member.id, {
    memberId: member.id,
    name: member.name,
    area: areaOfRole(member.role),
    avatarUrl: member.avatarUrl,
    openTasks: 0,
    created: 0,
    comments: 0,
    changes: 0,
    totalActivity: 0,
    statusMs: zeroByStatus(),
    statusTasks: zeroByStatus(),
    statusMaxMs: zeroByStatus(),
    totalStatusMs: 0,
    timedTasks: 0,
    workingMs: 0,
    waitingMs: 0,
    clientMs: 0,
    creativeDeliveries: 0,
    strategyTasks: 0,
  }]));
  const strategyTotals = new Map<string, { teamMs: number; clientMs: number }>();

  const emptyStage = (): DashboardClientStage => ({ tasks: 0, totalMs: 0, rounds: 0, waitingNow: 0, longestWaitingMs: 0 });
  const clientStages = { text: emptyStage(), creative: emptyStage() };
  const clientByProject = new Map<string, { text: DashboardClientStage; creative: DashboardClientStage }>();
  const phaseTotals = new Map<DashboardPhaseKey, { tasks: number; teamMs: number; clientMs: number }>(
    (Object.keys(PHASE_LABELS) as DashboardPhaseKey[]).map((key) => [key, { tasks: 0, teamMs: 0, clientMs: 0 }]),
  );

  const creativeCycles = new Map<string, { teamMs: number; clientMs: number }[]>();
  const allCreativeCycles: number[] = [];
  const allCreativeClientCycles: number[] = [];
  let creativeTasks = 0;
  let workingMs = 0;
  let waitingMs = 0;
  let clientMs = 0;
  let flowTasks = 0;
  for (const task of tasks) {
    if (task.assigneeId && memberMetrics.has(task.assigneeId)) {
      const metric = memberMetrics.get(task.assigneeId)!;
      if (!CLOSED_TASK_STATUSES.includes(task.status)) metric.openTasks += 1;
    }
    const intervals = timelines.get(task.id)!;
    const assignmentBoundaries = assigneeChanges(task).map((change) => change.at);
    // Por tarefa: quanto cada pessoa segurou em cada status, e quanto do
    // relógio criativo correu na mão de cada uma.
    const heldByOwner = new Map<string, Map<TaskStatus, number>>();
    const creativeByOwner = new Map<string, number>();
    const phasesSeen = new Set<DashboardPhaseKey>();
    const approvals = { text: { ms: 0, rounds: 0 }, creative: { ms: 0, rounds: 0 } };
    let creativeTotal = 0;
    let creativeClient = 0;
    let creativeStarted = false;
    let creativeDelivered = false;
    // A tarefa esteve na criação dentro do período.
    let creativeActive = false;
    // Quando o ciclo fechou: a entrada em Aprovado/Finalizado mais recente.
    let creativeClosedAt: number | undefined;
    let previousStop = false;
    let measured = false;
    for (const interval of intervals) {
      if (CREATIVE_START.has(interval.status)) {
        creativeStarted = true;
        if (interval.end > fromMs) creativeActive = true;
      }
      const stop = creativeStarted && CREATIVE_STOP.has(interval.status);
      if (stop) {
        creativeDelivered = true;
        if (!previousStop) creativeClosedAt = interval.start;
      }
      previousStop = stop;
      if (TERMINAL_STATUSES.has(interval.status) || interval.end <= interval.start) continue;
      const { status, end } = interval;
      const start = Math.max(interval.start, fromMs);
      // O ciclo criativo é medido inteiro, inclusive a parte anterior ao
      // período: o que o período decide é quais entregas fecharam nele.
      const running = creativeStarted && CREATIVE_START.has(status);
      if (running) creativeTotal += end - interval.start;
      if (creativeStarted && status === "para_aprovacao") creativeClient += end - interval.start;
      if (end > start) {
        if (WORKING_STATUSES.has(status)) { workingMs += end - start; measured = true; }
        else if (WAITING_STATUSES.has(status)) { waitingMs += end - start; measured = true; }
        else if (CLIENT_STATUSES.has(status)) { clientMs += end - start; measured = true; }
        const phase = PHASE_BY_STATUS[status];
        if (phase) {
          const totals = phaseTotals.get(phase)!;
          if (CLIENT_STATUSES.has(status)) totals.clientMs += end - start; else totals.teamMs += end - start;
          phasesSeen.add(phase);
        }
        if (CLIENT_STATUSES.has(status)) {
          const approval = status === "aprovacao_copy" ? approvals.text : approvals.creative;
          approval.ms += end - start;
          approval.rounds += 1;
        }
      }
      const points = [interval.start, ...assignmentBoundaries.filter((boundary) => boundary > interval.start && boundary < end), end];
      for (let index = 0; index < points.length - 1; index += 1) {
        const owner = assigneeAt(task, points[index]);
        if (!owner || !memberMetrics.has(owner)) continue;
        if (running) creativeByOwner.set(owner, (creativeByOwner.get(owner) || 0) + points[index + 1] - points[index]);
        const duration = points[index + 1] - Math.max(points[index], fromMs);
        if (duration <= 0) continue;
        const held = heldByOwner.get(owner) ?? new Map<TaskStatus, number>();
        held.set(status, (held.get(status) || 0) + duration);
        heldByOwner.set(owner, held);
      }
    }
    if (measured) flowTasks += 1;
    for (const phase of phasesSeen) phaseTotals.get(phase)!.tasks += 1;
    // Espera do cliente, por aprovação e por projeto. Aqui entra também a
    // tarefa que está esperando agora: é o atraso acontecendo, e o painel por
    // cliente existe pra mostrar isso antes de virar média.
    const lastInterval = intervals.at(-1);
    for (const kind of ["text", "creative"] as const) {
      const approval = approvals[kind];
      if (!approval.rounds) continue;
      const waiting = task.status === (kind === "text" ? "aprovacao_copy" : "para_aprovacao") && lastInterval?.status === task.status;
      const byProject = clientByProject.get(task.projectId) ?? { text: emptyStage(), creative: emptyStage() };
      clientByProject.set(task.projectId, byProject);
      for (const stage of [clientStages[kind], byProject[kind]]) {
        stage.tasks += 1;
        stage.totalMs += approval.ms;
        stage.rounds += approval.rounds;
        if (waiting && lastInterval) {
          stage.waitingNow += 1;
          stage.longestWaitingMs = Math.max(stage.longestWaitingMs, lastInterval.end - lastInterval.start);
        }
      }
    }
    for (const [owner, held] of heldByOwner) {
      const metric = memberMetrics.get(owner)!;
      let own = false;
      let strategyTeam = 0;
      let strategyClient = 0;
      for (const [status, duration] of held) {
        // Estratégia é a fase antes da criação e a de entrega, depois de
        // aprovada. A aprovação do texto é a espera do cliente dessa fase.
        if (status === "aprovacao_copy") strategyClient += duration;
        else if (PHASE_BY_STATUS[status] === "estrategia" || PHASE_BY_STATUS[status] === "entrega") strategyTeam += duration;
        metric.statusMs[status] += duration;
        metric.statusTasks[status] += 1;
        metric.statusMaxMs[status] = Math.max(metric.statusMaxMs[status], duration);
        // O status aparece na grade, mas a espera do cliente não soma no
        // tempo da pessoa.
        if (CLIENT_STATUSES.has(status)) { metric.clientMs += duration; continue; }
        own = true;
        metric.totalStatusMs += duration;
        if (WORKING_STATUSES.has(status)) metric.workingMs += duration;
        else if (WAITING_STATUSES.has(status)) metric.waitingMs += duration;
      }
      if (own) metric.timedTasks += 1;
      if (strategyTeam || strategyClient) {
        metric.strategyTasks += 1;
        const totals = strategyTotals.get(owner) ?? { teamMs: 0, clientMs: 0 };
        totals.teamMs += strategyTeam;
        totals.clientMs += strategyClient;
        strategyTotals.set(owner, totals);
      }
    }
    if (creativeActive) creativeTasks += 1;
    // Só entra na média o ciclo que fechou: chegou a Aprovado/Finalizado e
    // não voltou para a criação nem para a aprovação.
    if (creativeDelivered && !CREATIVE_OPEN.has(task.status) && inWindow(creativeClosedAt)) {
      allCreativeCycles.push(creativeTotal);
      allCreativeClientCycles.push(creativeClient);
      // A espera da entrega inteira vai para quem produziu, mesmo que a tarefa
      // tenha trocado de mão enquanto o cliente decidia.
      for (const [owner, share] of creativeByOwner) creativeCycles.set(owner, [...(creativeCycles.get(owner) || []), { teamMs: share, clientMs: creativeClient }]);
    }
    if (task.createdBy && memberMetrics.has(task.createdBy) && inWindow(timestamp(task.createdAt))) memberMetrics.get(task.createdBy)!.created += 1;
    for (const comment of task.comments) {
      if (!comment.authorMemberId || !memberMetrics.has(comment.authorMemberId) || !inWindow(timestamp(comment.createdAt))) continue;
      if (isUserComment(comment)) memberMetrics.get(comment.authorMemberId)!.comments += 1;
      else if (comment.fieldKey !== "created") memberMetrics.get(comment.authorMemberId)!.changes += 1;
    }
  }

  for (const metric of memberMetrics.values()) {
    const cycles = creativeCycles.get(metric.memberId) || [];
    metric.creativeDeliveries = cycles.length;
    metric.creativeAverageMs = cycles.length ? cycles.reduce((sum, cycle) => sum + cycle.teamMs, 0) / cycles.length : undefined;
    metric.creativeClientAverageMs = cycles.length ? cycles.reduce((sum, cycle) => sum + cycle.clientMs, 0) / cycles.length : undefined;
    const strategy = strategyTotals.get(metric.memberId);
    metric.strategyAverageMs = strategy ? strategy.teamMs / metric.strategyTasks : undefined;
    metric.strategyClientAverageMs = strategy ? strategy.clientMs / metric.strategyTasks : undefined;
    metric.totalActivity = metric.created + metric.comments + metric.changes;
  }
  const memberRows = [...memberMetrics.values()];
  const closeStage = (stage: DashboardClientStage): DashboardClientStage => ({ ...stage, averageMs: stage.tasks ? stage.totalMs / stage.tasks : undefined });
  // No topo, o cliente que está segurando demanda há mais tempo agora; depois,
  // quem costuma demorar mais.
  const clientProjects: DashboardClientWait[] = [...clientByProject]
    .map(([id, stages]) => ({ id, name: projectNames.get(id) || "Projeto removido", text: closeStage(stages.text), creative: closeStage(stages.creative) }))
    .sort((a, b) =>
      Math.max(b.text.longestWaitingMs, b.creative.longestWaitingMs) - Math.max(a.text.longestWaitingMs, a.creative.longestWaitingMs)
      || (b.text.totalMs + b.creative.totalMs) - (a.text.totalMs + a.creative.totalMs));
  // Uso do link pelo cliente. Só entra o que é de tarefa e projeto que a
  // pessoa logada enxerga, porque o filtro de acesso já foi aplicado nelas.
  type Responses = { actions: number; approvals: number; changes: number; comments: number; lastAction: number };
  const emptyResponses = (): Responses => ({ actions: 0, approvals: 0, changes: 0, comments: 0, lastAction: 0 });
  const closeResponses = ({ lastAction, ...counts }: Responses): DashboardClientResponses => ({ ...counts, lastActionDate: lastAction ? isoDateInSaoPaulo(lastAction) : undefined });
  const projectByTask = new Map(tasks.map((task) => [task.id, task.projectId]));
  const adoptionByProject = new Map<string, Responses & { reviewers: Set<string>; lastAccess: number }>();
  const adoptionOf = (projectId: string) => {
    const row = adoptionByProject.get(projectId) ?? { ...emptyResponses(), reviewers: new Set<string>(), lastAccess: 0 };
    adoptionByProject.set(projectId, row);
    return row;
  };
  const reviewerRows = new Map<string, Responses & { name: string; projectId: string }>();
  for (const link of clientActivity?.links ?? []) {
    if (!projectNames.has(link.projectId)) continue;
    const row = adoptionOf(link.projectId);
    row.lastAccess = Math.max(row.lastAccess, timestamp(link.lastUsedAt) ?? 0);
  }
  for (const event of clientActivity?.events ?? []) {
    const projectId = projectByTask.get(event.taskId);
    // Aprovação por prazo não é resposta do cliente: fica fora da adesão.
    if (!projectId || !projectNames.has(projectId) || event.action === "reopened" || event.reviewerName === AUTO_APPROVAL_REVIEWER) continue;
    const answeredAt = timestamp(event.createdAt);
    if (!inWindow(answeredAt) || (answeredAt !== undefined && answeredAt > nowMs)) continue;
    const name = event.reviewerName?.trim();
    const key = name ? `${projectId}:${name.toLowerCase()}` : undefined;
    const adoption = adoptionOf(projectId);
    if (key) adoption.reviewers.add(key);
    if (key && !reviewerRows.has(key)) reviewerRows.set(key, { ...emptyResponses(), name: name!, projectId });
    for (const row of [adoption, key ? reviewerRows.get(key)! : undefined]) {
      if (!row) continue;
      row.actions += 1;
      if (event.action === "approved") row.approvals += 1;
      if (event.action === "changes_requested" || event.action === "rejected") row.changes += 1;
      if (event.comment?.trim()) row.comments += 1;
      row.lastAction = Math.max(row.lastAction, timestamp(event.createdAt) ?? 0);
    }
  }
  const clientAdoption: DashboardClientAdoption[] = [...adoptionByProject]
    .sort(([, a], [, b]) => b.actions - a.actions || b.lastAccess - a.lastAccess)
    .map(([id, { reviewers, lastAccess, ...responses }]) => ({
      id,
      name: projectNames.get(id) || "Projeto removido",
      ...closeResponses(responses),
      reviewers: reviewers.size,
      lastAccessDate: lastAccess ? isoDateInSaoPaulo(lastAccess) : undefined,
    }));
  const reviewers: DashboardReviewer[] = [...reviewerRows]
    .sort(([, a], [, b]) => b.actions - a.actions || b.comments - a.comments)
    .slice(0, 8)
    .map(([key, { name, projectId, ...responses }]) => ({ key, name, projectName: projectNames.get(projectId) || "Projeto removido", ...closeResponses(responses) }));
  const phases: DashboardPhase[] = [...phaseTotals].map(([key, totals]) => ({
    key,
    label: PHASE_LABELS[key],
    tasks: totals.tasks,
    teamMs: totals.tasks ? totals.teamMs / totals.tasks : 0,
    clientMs: totals.tasks ? totals.clientMs / totals.tasks : 0,
  }));
  // O destaque de tempo criativo só compara quem é da criação.
  const withCreativeCycles = memberRows.filter((member) => member.area === "criacao" && member.creativeAverageMs !== undefined);

  const topCommented = tasks
    .map((task) => ({
      id: task.id,
      name: task.name,
      projectName: projectNames.get(task.projectId) || "Projeto removido",
      count: task.comments.filter((comment) => isUserComment(comment) && inWindow(timestamp(comment.createdAt))).length,
    }))
    .filter((task) => task.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Passagens de status recortadas no início do período: a que já tinha
  // terminado sai, a que estava em curso passa a contar dali.
  const historyInWindow = (task: Task) => fromMs === -Infinity ? task.statusHistory : task.statusHistory.flatMap((entry) => {
    if ((timestamp(entry.exitedAt) ?? nowMs) <= fromMs) return [];
    return [(timestamp(entry.enteredAt) ?? fromMs) < fromMs ? { ...entry, enteredAt: new Date(fromMs).toISOString() } : entry];
  });
  const reworkByTask = new Map<string, { visits: number; totalMs: number }>();
  const reworkTasks = tasks
    .map((task) => {
      const adjustment = summarizeStatusDurations(historyInWindow(task), nowMs).find((item) => item.status === "ajuste");
      if (adjustment) reworkByTask.set(task.id, { visits: adjustment.visits, totalMs: adjustment.totalMs });
      return {
        id: task.id,
        name: task.name,
        projectName: projectNames.get(task.projectId) || "Projeto removido",
        count: adjustment?.visits || 0,
        visits: adjustment?.visits || 0,
        totalMs: adjustment?.totalMs || 0,
      };
    })
    .filter((task) => task.count > 0)
    .sort((a, b) => (b.totalMs || 0) - (a.totalMs || 0) || b.count - a.count);

  const alerts: DashboardDataAlert[] = [];
  for (const task of tasks.filter((item) => !CLOSED_TASK_STATUSES.includes(item.status))) {
    const projectName = projectNames.get(task.projectId) || "Projeto removido";
    for (const gap of findTaskGaps(task, tags)) {
      alerts.push({ id: `${task.id}:${gap.type}`, taskId: task.id, taskName: task.name, projectName, ...gap });
    }
  }
  alerts.sort((a, b) => Number(b.critical) - Number(a.critical) || a.projectName.localeCompare(b.projectName));

  const reschedules = tasks.flatMap((task): DashboardReschedule[] => {
    const changes = dueDateChanges(task);
    const recent = changes.filter((change) => inWindow(timestamp(change.createdAt)));
    if (!recent.length) return [];
    const original = originalDueDate(task);
    const currentDate = task.dueDate || (typeof changes.at(-1)?.newValue === "string" ? String(changes.at(-1)?.newValue).slice(0, 10) : undefined);
    const closure = completedAt(task);
    return [{
      id: task.id,
      taskId: task.id,
      taskName: task.name,
      projectName: projectNames.get(task.projectId) || "Projeto removido",
      originalDate: original,
      currentDate,
      completedDate: closure === undefined ? undefined : isoDateInSaoPaulo(closure),
      changes: recent.length,
      movedDays: calendarDays(original, currentDate),
    }];
  }).sort((a, b) => Math.abs(b.movedDays) - Math.abs(a.movedDays) || b.changes - a.changes);

  const lateness = tasks.map((task) => overdueDays(task.dueDate, task.status, today)).filter((days) => days > 0);
  const delayBuckets = [
    { label: "1 dia", count: lateness.filter((days) => days === 1).length, color: "#f3b33d" },
    { label: "2–3 dias", count: lateness.filter((days) => days >= 2 && days <= 3).length, color: "#ed8d33" },
    { label: "4–7 dias", count: lateness.filter((days) => days >= 4 && days <= 7).length, color: "#e45b45" },
    { label: "8+ dias", count: lateness.filter((days) => days >= 8).length, color: "#b73535" },
  ];

  const chart = chartBuckets(fromMs, nowMs);
  const throughput = chart.buckets.map(({ startMs, endMs, label }) => {
    return {
      label,
      start: isoDateInSaoPaulo(startMs),
      created: tasks.filter((task) => {
        const value = timestamp(task.createdAt);
        return value !== undefined && value >= startMs && value < endMs;
      }).length,
      completed: tasks.filter((task) => {
        const value = completedAt(task);
        return value !== undefined && value >= startMs && value < endMs;
      }).length,
    };
  });

  // Fluxo cumulativo: uma fotografia do fim de cada coluna mostrando quanta
  // demanda estava parada, em produção e entregue. É onde a fila que engrossa
  // aparece antes de virar atraso. Descartada (Problema) não é entrega e fica
  // de fora.
  const cumulativeFlow: DashboardFlowPoint[] = chart.buckets.map((bucket) => {
    const snapshotMs = Math.min(nowMs, bucket.endMs - 1);
    const counts: Record<StatusGroup, number> = { nao_iniciada: 0, em_andamento: 0, feita: 0 };
    for (const task of tasks) {
      const status = timelines.get(task.id)!.findLast((interval) => interval.start <= snapshotMs)?.status;
      if (!status || status === "problema") continue;
      counts[GROUP_BY_STATUS.get(status) || "nao_iniciada"] += 1;
    }
    return {
      label: chart.unit === "mes" ? bucket.label : shortDate(snapshotMs),
      start: isoDateInSaoPaulo(snapshotMs),
      ...counts,
      total: counts.nao_iniciada + counts.em_andamento + counts.feita,
    };
  });

  // Lead time: da criação até o fechamento. A média sozinha esconde a cauda —
  // por isso guardamos também a mediana e o P85, que é o prazo que dá pra
  // prometer sem mentir.
  const leadOf = (task: Task) => {
    const start = startedAt(task);
    const finished = completedAt(task);
    return start !== undefined && finished !== undefined && finished > start && inWindow(finished) ? finished - start : undefined;
  };
  const leadTimes = tasks.map(leadOf).filter((value): value is number => value !== undefined);
  const histogramEdges = [1, 3, 7, 14, 30];
  const leadTimeDays = leadTimes.map((value) => value / DAY);
  const leadTime: DashboardLeadTime = {
    samples: leadTimes.length,
    p50Ms: percentile(leadTimes, 0.5),
    p85Ms: percentile(leadTimes, 0.85),
    averageMs: leadTimes.length ? leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length : undefined,
    histogram: [
      { label: "até 1d", count: leadTimeDays.filter((days) => days <= histogramEdges[0]).length },
      { label: "1–3d", count: leadTimeDays.filter((days) => days > histogramEdges[0] && days <= histogramEdges[1]).length },
      { label: "3–7d", count: leadTimeDays.filter((days) => days > histogramEdges[1] && days <= histogramEdges[2]).length },
      { label: "7–14d", count: leadTimeDays.filter((days) => days > histogramEdges[2] && days <= histogramEdges[3]).length },
      { label: "14–30d", count: leadTimeDays.filter((days) => days > histogramEdges[3] && days <= histogramEdges[4]).length },
      { label: "30d+", count: leadTimeDays.filter((days) => days > histogramEdges[4]).length },
    ],
  };

  // Pontualidade medida duas vezes: contra a data que está valendo hoje e
  // contra a data prometida antes de qualquer remarcação. A diferença entre as
  // duas é exatamente o tanto que o planejamento foi empurrado.
  const deliveries = tasks.flatMap((task) => {
    const finished = completedAt(task);
    if (finished === undefined || !inWindow(finished)) return [];
    const current = task.dueDate;
    const original = originalDueDate(task);
    if (!current && !original) return [];
    return [{ closedOn: isoDateInSaoPaulo(finished), current, original }];
  });
  const keptCurrent = deliveries.filter((delivery) => !delivery.current || delivery.closedOn <= delivery.current).length;
  const keptOriginal = deliveries.filter((delivery) => !delivery.original || delivery.closedOn <= delivery.original).length;
  const slips = deliveries.map((delivery) => calendarDays(delivery.original || delivery.current, delivery.closedOn));
  const punctuality: DashboardPunctuality = {
    delivered: deliveries.length,
    keptCurrent,
    keptOriginal,
    currentRate: deliveries.length ? Math.round((keptCurrent / deliveries.length) * 100) : 0,
    originalRate: deliveries.length ? Math.round((keptOriginal / deliveries.length) * 100) : 0,
    averageSlipDays: slips.length ? Math.round((slips.reduce((sum, value) => sum + value, 0) / slips.length) * 10) / 10 : 0,
  };

  const projectHealth: DashboardProjectHealth[] = projects
    .map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      const done = projectTasks.filter((task) => task.status === "finalizado").length;
      const projectLeads = projectTasks.map(leadOf).filter((value): value is number => value !== undefined);
      return {
        id: project.id,
        name: project.name,
        total: projectTasks.length,
        done,
        open: projectTasks.filter((task) => !CLOSED_TASK_STATUSES.includes(task.status)).length,
        overdue: projectTasks.filter((task) => overdueDays(task.dueDate, task.status, today) > 0).length,
        rework: projectTasks.filter((task) => reworkByTask.has(task.id)).length,
        alerts: alerts.filter((alert) => projectTasks.some((task) => task.id === alert.taskId)).length,
        progress: projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0,
        leadTimeMs: projectLeads.length ? projectLeads.reduce((sum, value) => sum + value, 0) / projectLeads.length : undefined,
      };
    })
    .filter((project) => project.total > 0)
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open);

  return {
    generatedAt: nowIso,
    totalTasks: tasks.length,
    activeTasks: tasks.filter((task) => !CLOSED_TASK_STATUSES.includes(task.status)).length,
    overdueTasks: lateness.length,
    reworkRate: creativeTasks ? Math.round((reworkTasks.length / creativeTasks) * 100) : 0,
    reworkedTasks: reworkTasks.length,
    averageCreativeMs: allCreativeCycles.length ? allCreativeCycles.reduce((sum, value) => sum + value, 0) / allCreativeCycles.length : undefined,
    averageCreativeClientMs: allCreativeClientCycles.length ? allCreativeClientCycles.reduce((sum, value) => sum + value, 0) / allCreativeClientCycles.length : undefined,
    creativeDeliveries: allCreativeCycles.length,
    clientWait: { text: closeStage(clientStages.text), creative: closeStage(clientStages.creative), projects: clientProjects },
    clientAdoption,
    reviewers,
    phases,
    creativeTasks,
    criticalAlerts: alerts.filter((alert) => alert.critical).length,
    flowEfficiency: {
      workingMs,
      waitingMs,
      clientMs,
      ratio: workingMs + waitingMs ? Math.round((workingMs / (workingMs + waitingMs)) * 100) : 0,
      tasks: flowTasks,
    },
    leadTime,
    punctuality,
    members: memberRows,
    slowestCreative: withCreativeCycles.sort((a, b) => (b.creativeAverageMs || 0) - (a.creativeAverageMs || 0))[0],
    mostLoaded: [...memberRows].sort((a, b) => b.openTasks - a.openTasks)[0],
    mostActive: [...memberRows].sort((a, b) => b.totalActivity - a.totalActivity)[0],
    idleMembers: memberRows.filter((member) => member.totalActivity === 0 && member.openTasks === 0),
    topCommented,
    reworkTasks: reworkTasks.slice(0, 6),
    alerts,
    reschedules,
    delayBuckets,
    periodTotals: {
      created: tasks.filter((task) => inWindow(timestamp(task.createdAt))).length,
      completed: tasks.filter((task) => { const finished = completedAt(task); return finished !== undefined && inWindow(finished); }).length,
    },
    bucketUnit: chart.unit,
    throughput,
    cumulativeFlow,
    projectHealth,
  };
}

/** A tarefa como ela estava em um instante passado: status, responsável, prazo
 * e comentários daquele momento. Tarefa que ainda não existia some. É o que
 * permite olhar um período que já acabou sem contaminar a conta com o que
 * aconteceu depois. Formato, canal e material não têm histórico e ficam como
 * estão hoje. */
function rewindTask(task: Task, atMs: number): Task | undefined {
  const history = task.statusHistory
    .filter((entry) => (timestamp(entry.enteredAt) ?? Infinity) <= atMs)
    .map((entry) => (timestamp(entry.exitedAt) ?? Infinity) > atMs ? { ...entry, exitedAt: null } : entry);
  const created = timestamp(task.createdAt);
  if (!history.length && created !== undefined && created > atMs) return undefined;
  const byEntry = (a: { enteredAt: string }, b: { enteredAt: string }) => (timestamp(a.enteredAt) ?? 0) - (timestamp(b.enteredAt) ?? 0);
  const status = [...history].sort(byEntry).at(-1)?.status ?? [...task.statusHistory].sort(byEntry)[0]?.status ?? task.status;
  let dueDate = task.dueDate;
  for (const change of dueDateChanges(task).toReversed()) {
    if ((timestamp(change.createdAt) ?? 0) <= atMs) break;
    dueDate = typeof change.oldValue === "string" && change.oldValue ? change.oldValue.slice(0, 10) : undefined;
  }
  return {
    ...task,
    status,
    statusHistory: history,
    assigneeId: assigneeAt(task, atMs),
    dueDate,
    comments: task.comments.filter((comment) => (timestamp(comment.createdAt) ?? 0) <= atMs),
  };
}

export type DashboardWindow = { fromIso: string; toIso: string };

/** Os indicadores do período anterior, para medir a variação. Fica `undefined`
 * o que não teve base para ser calculado. */
export type DashboardComparison = {
  averageCreativeMs?: number;
  flowRatio?: number;
  punctualityRate?: number;
  p85Ms?: number;
  reworkRate?: number;
  overdueTasks: number;
  completed: number;
  created: number;
};

/** Monta o dashboard de um período e, se pedido, os indicadores do período
 * anterior. Os dois saem da mesma conta, cada um com a sua janela. */
export function buildDashboardReport({
  window,
  previous,
  ...input
}: Omit<Parameters<typeof buildDashboardMetrics>[0], "fromIso"> & { window?: DashboardWindow; previous?: DashboardWindow }): { metrics: DashboardMetrics; comparison?: DashboardComparison } {
  const nowMs = new Date(input.nowIso).getTime();
  const build = (range: DashboardWindow) => {
    const endMs = Math.min(nowMs, timestamp(range.toIso) ?? nowMs);
    return buildDashboardMetrics({
      ...input,
      tasks: endMs < nowMs ? input.tasks.flatMap((task) => rewindTask(task, endMs) ?? []) : input.tasks,
      nowIso: new Date(endMs).toISOString(),
      fromIso: range.fromIso,
    });
  };
  const metrics = window ? build(window) : buildDashboardMetrics(input);
  if (!previous) return { metrics };
  const before = build(previous);
  return {
    metrics,
    comparison: {
      averageCreativeMs: before.averageCreativeMs,
      flowRatio: before.flowEfficiency.workingMs + before.flowEfficiency.waitingMs ? before.flowEfficiency.ratio : undefined,
      punctualityRate: before.punctuality.delivered ? before.punctuality.originalRate : undefined,
      p85Ms: before.leadTime.p85Ms,
      reworkRate: before.creativeTasks ? before.reworkRate : undefined,
      overdueTasks: before.overdueTasks,
      completed: before.periodTotals.completed,
      created: before.periodTotals.created,
    },
  };
}
