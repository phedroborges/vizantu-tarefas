import { isoDateInSaoPaulo, overdueDays, summarizeStatusDurations } from "./dates";
import { isUserComment } from "./task-activity";
import { findTaskGaps, type TaskGapType } from "./task-readiness";
import {
  CLOSED_TASK_STATUSES,
  TASK_STATUSES,
  type Member,
  type Project,
  type StatusGroup,
  type Tag,
  type Task,
  type TaskStatus,
} from "./types";

const DAY = 86_400_000;
// O Brasil não tem mais horário de verão: São Paulo é UTC-3 o ano inteiro.
const SP_OFFSET = 3 * 3_600_000;

// Relógio do ciclo criativo: liga quando a demanda entra em "Pronto para
// criação" (ou em qualquer etapa de produção), segue ligado enquanto ela está
// com o time ou aguardando o cliente aprovar, e desliga em Aprovado ou
// Finalizado. Se a demanda volta para Ajuste, liga de novo e soma. Voltar para
// uma etapa anterior à criação (texto, captação) pausa o relógio.
const CREATIVE_START = new Set<TaskStatus>(["pronto_para_criacao", "em_criacao", "revisao", "ajuste"]);
const CREATIVE_RUNNING = new Set<TaskStatus>([...CREATIVE_START, "para_aprovacao"]);
const CREATIVE_STOP = new Set<TaskStatus>(["aprovado", "finalizado"]);

// Finalizado e Problema encerram a demanda. A entrada aberta desses status
// nunca fecha — contar o tempo dela faria toda tarefa entregue "envelhecer"
// para sempre na conta de quem a entregou.
const TERMINAL_STATUSES = new Set<TaskStatus>(CLOSED_TASK_STATUSES);
export const TIMED_STATUSES = TASK_STATUSES.filter(({ value }) => !TERMINAL_STATUSES.has(value));

// Eficiência de fluxo: das horas que a demanda passou sob nossa
// responsabilidade, quantas alguém estava de fato com a mão nela.
const WORKING_STATUSES = new Set<TaskStatus>(["em_criacao", "revisao", "ajuste"]);
const WAITING_STATUSES = new Set<TaskStatus>([
  "rascunho", "aguardando_informacao", "aprovacao_copy", "aguardando_captacao", "pronto_para_criacao", "para_aprovacao",
]);

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

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });

function shortDate(ms: number): string {
  return shortDateFormatter.format(new Date(ms)).replace(".", "");
}

export type DashboardMemberMetric = {
  memberId: string;
  name: string;
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
  totalStatusMs: number;
  /** Tarefas diferentes com tempo medido sob a responsabilidade da pessoa. */
  timedTasks: number;
  workingMs: number;
  waitingMs: number;
  creativeAverageMs?: number;
  creativeDeliveries: number;
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
  creativeDeliveries: number;
  /** Tarefas que chegaram a entrar na criação: a base da taxa de retrabalho. */
  creativeTasks: number;
  criticalAlerts: number;
  flowEfficiency: { workingMs: number; waitingMs: number; ratio: number; tasks: number };
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
  throughput: { label: string; start: string; created: number; completed: number }[];
  cumulativeFlow: DashboardFlowPoint[];
  projectHealth: DashboardProjectHealth[];
};

export function buildDashboardMetrics({
  tasks,
  projects,
  members,
  tags,
  nowIso,
}: {
  tasks: Task[];
  projects: Project[];
  members: Member[];
  tags: Tag[];
  nowIso: string;
}): DashboardMetrics {
  const nowMs = new Date(nowIso).getTime();
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
    creativeDeliveries: 0,
  }]));

  const creativeCycles = new Map<string, number[]>();
  const allCreativeCycles: number[] = [];
  let creativeTasks = 0;
  let workingMs = 0;
  let waitingMs = 0;
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
    let creativeTotal = 0;
    let creativeStarted = false;
    let creativeDelivered = false;
    let measured = false;
    for (const interval of intervals) {
      if (CREATIVE_START.has(interval.status)) creativeStarted = true;
      if (creativeStarted && CREATIVE_STOP.has(interval.status)) creativeDelivered = true;
      if (TERMINAL_STATUSES.has(interval.status) || interval.end <= interval.start) continue;
      const { status, start, end } = interval;
      if (WORKING_STATUSES.has(status)) { workingMs += end - start; measured = true; }
      else if (WAITING_STATUSES.has(status)) { waitingMs += end - start; measured = true; }
      const running = creativeStarted && CREATIVE_RUNNING.has(status);
      if (running) creativeTotal += end - start;
      const points = [start, ...assignmentBoundaries.filter((boundary) => boundary > start && boundary < end), end];
      for (let index = 0; index < points.length - 1; index += 1) {
        const owner = assigneeAt(task, points[index]);
        if (!owner || !memberMetrics.has(owner)) continue;
        const duration = points[index + 1] - points[index];
        const held = heldByOwner.get(owner) ?? new Map<TaskStatus, number>();
        held.set(status, (held.get(status) || 0) + duration);
        heldByOwner.set(owner, held);
        if (running) creativeByOwner.set(owner, (creativeByOwner.get(owner) || 0) + duration);
      }
    }
    if (measured) flowTasks += 1;
    for (const [owner, held] of heldByOwner) {
      const metric = memberMetrics.get(owner)!;
      metric.timedTasks += 1;
      for (const [status, duration] of held) {
        metric.statusMs[status] += duration;
        metric.statusTasks[status] += 1;
        metric.statusMaxMs[status] = Math.max(metric.statusMaxMs[status], duration);
        metric.totalStatusMs += duration;
        if (WORKING_STATUSES.has(status)) metric.workingMs += duration;
        else if (WAITING_STATUSES.has(status)) metric.waitingMs += duration;
      }
    }
    if (creativeStarted) creativeTasks += 1;
    // Só entra na média o ciclo que fechou: chegou a Aprovado/Finalizado e o
    // relógio não voltou a correr (não está de novo em ajuste ou aprovação).
    if (creativeDelivered && !CREATIVE_RUNNING.has(task.status)) {
      allCreativeCycles.push(creativeTotal);
      for (const [owner, share] of creativeByOwner) creativeCycles.set(owner, [...(creativeCycles.get(owner) || []), share]);
    }
    if (task.createdBy && memberMetrics.has(task.createdBy)) memberMetrics.get(task.createdBy)!.created += 1;
    for (const comment of task.comments) {
      if (!comment.authorMemberId || !memberMetrics.has(comment.authorMemberId)) continue;
      if (isUserComment(comment)) memberMetrics.get(comment.authorMemberId)!.comments += 1;
      else if (comment.fieldKey !== "created") memberMetrics.get(comment.authorMemberId)!.changes += 1;
    }
  }

  for (const metric of memberMetrics.values()) {
    const cycles = creativeCycles.get(metric.memberId) || [];
    metric.creativeDeliveries = cycles.length;
    metric.creativeAverageMs = cycles.length ? cycles.reduce((sum, value) => sum + value, 0) / cycles.length : undefined;
    metric.totalActivity = metric.created + metric.comments + metric.changes;
  }
  const memberRows = [...memberMetrics.values()];
  const withCreativeCycles = memberRows.filter((member) => member.creativeAverageMs !== undefined);

  const topCommented = tasks
    .map((task) => ({
      id: task.id,
      name: task.name,
      projectName: projectNames.get(task.projectId) || "Projeto removido",
      count: task.comments.filter(isUserComment).length,
    }))
    .filter((task) => task.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const reworkByTask = new Map<string, { visits: number; totalMs: number }>();
  const reworkTasks = tasks
    .map((task) => {
      const adjustment = summarizeStatusDurations(task.statusHistory, nowMs).find((item) => item.status === "ajuste");
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
    if (!changes.length) return [];
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
      changes: changes.length,
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

  const thisWeek = weekStart(nowMs);
  const throughput = Array.from({ length: 8 }, (_, index) => {
    const startMs = thisWeek - (7 - index) * 7 * DAY;
    const endMs = startMs + 7 * DAY;
    return {
      label: shortDate(startMs),
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

  // Fluxo cumulativo: uma fotografia do fim de cada semana mostrando quanta
  // demanda estava parada, em produção e entregue. É onde a fila que engrossa
  // aparece antes de virar atraso. Descartada (Problema) não é entrega e fica
  // de fora.
  const cumulativeFlow: DashboardFlowPoint[] = Array.from({ length: 8 }, (_, index) => {
    const snapshotMs = Math.min(nowMs, thisWeek - (7 - index) * 7 * DAY + 7 * DAY - 1);
    const counts: Record<StatusGroup, number> = { nao_iniciada: 0, em_andamento: 0, feita: 0 };
    for (const task of tasks) {
      const status = timelines.get(task.id)!.findLast((interval) => interval.start <= snapshotMs)?.status;
      if (!status || status === "problema") continue;
      counts[GROUP_BY_STATUS.get(status) || "nao_iniciada"] += 1;
    }
    return {
      label: shortDate(snapshotMs),
      start: isoDateInSaoPaulo(snapshotMs),
      ...counts,
      total: counts.nao_iniciada + counts.em_andamento + counts.feita,
    };
  });

  // Lead time: da criação até o fechamento. A média sozinha esconde a cauda —
  // por isso guardamos também a mediana e o P85, que é o prazo que dá pra
  // prometer sem mentir.
  const leadTimes = tasks
    .map((task) => {
      const start = startedAt(task);
      const finished = completedAt(task);
      return start !== undefined && finished !== undefined && finished > start ? finished - start : undefined;
    })
    .filter((value): value is number => value !== undefined);
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
    if (finished === undefined) return [];
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
      const projectLeads = projectTasks
        .map((task) => {
          const start = startedAt(task);
          const finished = completedAt(task);
          return start !== undefined && finished !== undefined && finished > start ? finished - start : undefined;
        })
        .filter((value): value is number => value !== undefined);
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
    creativeDeliveries: allCreativeCycles.length,
    creativeTasks,
    criticalAlerts: alerts.filter((alert) => alert.critical).length,
    flowEfficiency: {
      workingMs,
      waitingMs,
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
    throughput,
    cumulativeFlow,
    projectHealth,
  };
}
