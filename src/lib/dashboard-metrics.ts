import { overdueDays, summarizeStatusDurations } from "./dates";
import { isUserComment } from "./task-activity";
import { findTaskGaps, type TaskGapType } from "./task-readiness";
import {
  TASK_STATUSES,
  type Member,
  type Project,
  type StatusGroup,
  type StatusHistoryEntry,
  type Tag,
  type Task,
  type TaskStatus,
} from "./types";

const DAY = 86_400_000;
const CREATIVE_START = new Set<TaskStatus>(["pronto_para_criacao", "em_criacao", "revisao", "ajuste"]);
const CREATIVE_DELIVERY = new Set<TaskStatus>(["para_aprovacao", "aprovado", "finalizado"]);

// Eficiência de fluxo: das horas que a demanda passou sob nossa
// responsabilidade, quantas alguém estava de fato com a mão nela. Os status
// "feita" ficam de fora dos dois lados — depois de entregue o relógio não é
// mais nosso, e a entrada aberta de Finalizado cresceria para sempre.
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

function firstEntry(history: StatusHistoryEntry[], statuses: Set<TaskStatus>, after = -Infinity): number | undefined {
  return history
    .filter((entry) => statuses.has(entry.status))
    .map((entry) => timestamp(entry.enteredAt))
    .filter((value): value is number => value !== undefined && value >= after)
    .sort((a, b) => a - b)[0];
}

function completedAt(task: Task): number | undefined {
  return firstEntry(task.statusHistory, new Set<TaskStatus>(["finalizado"]));
}

function creativeCycleMs(task: Task): number | undefined {
  const start = firstEntry(task.statusHistory, CREATIVE_START);
  if (start === undefined) return undefined;
  const delivered = firstEntry(task.statusHistory, CREATIVE_DELIVERY, start);
  return delivered === undefined ? undefined : Math.max(0, delivered - start);
}

/** Quando a tarefa começou a existir para o time: o primeiro registro de
 * status, ou a criação, o que vier antes. */
function startedAt(task: Task): number | undefined {
  const created = timestamp(task.createdAt);
  const entered = task.statusHistory
    .map((entry) => timestamp(entry.enteredAt))
    .filter((value): value is number => value !== undefined)
    .sort((a, b) => a - b)[0];
  if (entered === undefined) return created;
  return created === undefined ? entered : Math.min(created, entered);
}

/** Em que status a tarefa estava num instante do passado. Vale a entrada mais
 * recente que já tinha começado e ainda não tinha terminado. */
function statusAt(task: Task, at: number): TaskStatus | undefined {
  let found: { status: TaskStatus; start: number } | undefined;
  for (const entry of task.statusHistory) {
    const start = timestamp(entry.enteredAt);
    if (start === undefined || start > at) continue;
    const end = entry.exitedAt ? timestamp(entry.exitedAt) : undefined;
    if (end !== undefined && end <= at) continue;
    if (!found || start >= found.start) found = { status: entry.status, start };
  }
  return found?.status;
}

/** Desde quando a tarefa está parada no status em que está hoje. */
function inCurrentStatusSince(task: Task): number | undefined {
  const matching = task.statusHistory
    .filter((entry) => entry.status === task.status)
    .map((entry) => ({ start: timestamp(entry.enteredAt), open: !entry.exitedAt }))
    .filter((entry): entry is { start: number; open: boolean } => entry.start !== undefined)
    .sort((a, b) => b.start - a.start);
  return (matching.find((entry) => entry.open) || matching[0])?.start;
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

function weekStart(date: Date): Date {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - weekday);
  return copy;
}

function shortDate(ms: number): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })
    .format(new Date(ms))
    .replace(".", "");
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
  statusMs: Record<TaskStatus, number>;
  totalStatusMs: number;
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

export type DashboardAgingItem = {
  taskId: string;
  taskName: string;
  projectName: string;
  assigneeName?: string;
  status: TaskStatus;
  group: StatusGroup;
  days: number;
  overdue: boolean;
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
  criticalAlerts: number;
  flowEfficiency: { workingMs: number; waitingMs: number; ratio: number };
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
  aging: DashboardAgingItem[];
  agingThresholdDays: number;
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
  const today = nowIso.slice(0, 10);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const activeMembers = members.filter((member) => member.active);

  const memberMetrics = new Map<string, DashboardMemberMetric>(activeMembers.map((member) => [member.id, {
    memberId: member.id,
    name: member.name,
    avatarUrl: member.avatarUrl,
    openTasks: 0,
    created: 0,
    comments: 0,
    changes: 0,
    totalActivity: 0,
    statusMs: Object.fromEntries(TASK_STATUSES.map(({ value }) => [value, 0])) as Record<TaskStatus, number>,
    totalStatusMs: 0,
    workingMs: 0,
    waitingMs: 0,
    creativeDeliveries: 0,
  }]));

  const creativeCycles = new Map<string, number[]>();
  let workingMs = 0;
  let waitingMs = 0;
  for (const task of tasks) {
    if (task.assigneeId && memberMetrics.has(task.assigneeId)) {
      const metric = memberMetrics.get(task.assigneeId)!;
      if (task.status !== "finalizado") metric.openTasks += 1;
    }
    const assignmentBoundaries = assigneeChanges(task).map((change) => change.at);
    for (const entry of task.statusHistory) {
      const start = timestamp(entry.enteredAt);
      const end = entry.exitedAt ? timestamp(entry.exitedAt) : nowMs;
      if (start === undefined || end === undefined || end <= start) continue;
      if (WORKING_STATUSES.has(entry.status)) workingMs += end - start;
      else if (WAITING_STATUSES.has(entry.status)) waitingMs += end - start;
      const points = [start, ...assignmentBoundaries.filter((boundary) => boundary > start && boundary < end), end];
      for (let index = 0; index < points.length - 1; index += 1) {
        const owner = assigneeAt(task, points[index]);
        if (!owner || !memberMetrics.has(owner)) continue;
        const duration = points[index + 1] - points[index];
        const metric = memberMetrics.get(owner)!;
        metric.statusMs[entry.status] += duration;
        metric.totalStatusMs += duration;
        if (WORKING_STATUSES.has(entry.status)) metric.workingMs += duration;
        else if (WAITING_STATUSES.has(entry.status)) metric.waitingMs += duration;
      }
    }
    const cycle = creativeCycleMs(task);
    if (cycle !== undefined) {
      const start = firstEntry(task.statusHistory, CREATIVE_START)!;
      const deliveredAt = firstEntry(task.statusHistory, CREATIVE_DELIVERY, start)!;
      const creativeOwner = assigneeAt(task, deliveredAt);
      if (creativeOwner && memberMetrics.has(creativeOwner)) creativeCycles.set(creativeOwner, [...(creativeCycles.get(creativeOwner) || []), cycle]);
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
  const allCreativeCycles = [...creativeCycles.values()].flat();

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
  for (const task of tasks.filter((item) => item.status !== "finalizado")) {
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
      completedDate: closure === undefined ? undefined : new Date(closure).toISOString().slice(0, 10),
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

  const thisWeek = weekStart(new Date(nowIso));
  const throughput = Array.from({ length: 8 }, (_, index) => {
    const startMs = thisWeek.getTime() - (7 - index) * 7 * DAY;
    const endMs = startMs + 7 * DAY;
    return {
      label: shortDate(startMs),
      start: new Date(startMs).toISOString().slice(0, 10),
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
  // aparece antes de virar atraso.
  const cumulativeFlow: DashboardFlowPoint[] = Array.from({ length: 8 }, (_, index) => {
    const snapshotMs = Math.min(nowMs, thisWeek.getTime() - (7 - index) * 7 * DAY + 7 * DAY - 1);
    const counts: Record<StatusGroup, number> = { nao_iniciada: 0, em_andamento: 0, feita: 0 };
    for (const task of tasks) {
      const status = statusAt(task, snapshotMs);
      if (!status) continue;
      counts[GROUP_BY_STATUS.get(status) || "nao_iniciada"] += 1;
    }
    return {
      label: shortDate(snapshotMs),
      start: new Date(snapshotMs).toISOString().slice(0, 10),
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
    return [{ closedOn: new Date(finished).toISOString().slice(0, 10), current, original }];
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

  // Envelhecimento: quanto tempo cada demanda aberta está parada no status em
  // que está. Diferente do atraso, aparece antes do prazo estourar.
  const aging: DashboardAgingItem[] = tasks
    .filter((task) => task.status !== "finalizado")
    .flatMap((task) => {
      const since = inCurrentStatusSince(task);
      if (since === undefined || since > nowMs) return [];
      return [{
        taskId: task.id,
        taskName: task.name,
        projectName: projectNames.get(task.projectId) || "Projeto removido",
        assigneeName: task.assigneeId ? memberNames.get(task.assigneeId) : undefined,
        status: task.status,
        group: GROUP_BY_STATUS.get(task.status) || "nao_iniciada",
        days: Math.round(((nowMs - since) / DAY) * 10) / 10,
        overdue: overdueDays(task.dueDate, task.status, today) > 0,
      }];
    })
    .sort((a, b) => b.days - a.days);
  const agingThresholdDays = Math.round(((leadTime.p85Ms ?? percentile(aging.map((item) => item.days * DAY), 0.85) ?? 0) / DAY) * 10) / 10;

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
        open: projectTasks.length - done,
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
    activeTasks: tasks.filter((task) => task.status !== "finalizado").length,
    overdueTasks: lateness.length,
    reworkRate: tasks.length ? Math.round((reworkTasks.length / tasks.length) * 100) : 0,
    reworkedTasks: reworkTasks.length,
    averageCreativeMs: allCreativeCycles.length ? allCreativeCycles.reduce((sum, value) => sum + value, 0) / allCreativeCycles.length : undefined,
    creativeDeliveries: allCreativeCycles.length,
    criticalAlerts: alerts.filter((alert) => alert.critical).length,
    flowEfficiency: {
      workingMs,
      waitingMs,
      ratio: workingMs + waitingMs ? Math.round((workingMs / (workingMs + waitingMs)) * 100) : 0,
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
    aging,
    agingThresholdDays,
    cumulativeFlow,
    projectHealth,
  };
}
