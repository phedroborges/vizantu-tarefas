import { overdueDays, summarizeStatusDurations } from "./dates";
import { isUserComment } from "./task-activity";
import {
  TASK_STATUSES,
  type Member,
  type Project,
  type StatusHistoryEntry,
  type Tag,
  type Task,
  type TaskStatus,
} from "./types";

const DAY = 86_400_000;
const CREATIVE_START = new Set<TaskStatus>(["pronto_para_criacao", "em_criacao", "revisao", "ajuste"]);
const CREATIVE_DELIVERY = new Set<TaskStatus>(["para_aprovacao", "aprovado", "finalizado"]);
const NEEDS_LINK = new Set<TaskStatus>(["pronto_para_criacao", "em_criacao", "revisao", "ajuste", "para_aprovacao"]);

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

function assigneeChanges(task: Task) {
  return task.comments
    .filter((comment) => comment.kind === "activity" && comment.fieldKey === "assigneeId")
    .map((comment) => ({ at: timestamp(comment.createdAt) || 0, oldValue: comment.oldValue }))
    .sort((a, b) => a.at - b.at);
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
  type: "link" | "responsavel" | "prazo" | "formato" | "canal";
  label: string;
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
  members: DashboardMemberMetric[];
  slowestCreative?: DashboardMemberMetric;
  mostLoaded?: DashboardMemberMetric;
  mostActive?: DashboardMemberMetric;
  topCommented: DashboardTaskMetric[];
  reworkTasks: DashboardTaskMetric[];
  alerts: DashboardDataAlert[];
  reschedules: DashboardReschedule[];
  delayBuckets: { label: string; count: number; color: string }[];
  throughput: { label: string; start: string; created: number; completed: number }[];
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
  const tagKinds = new Map(tags.map((tag) => [tag.id, tag.kind]));
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
    creativeDeliveries: 0,
  }]));

  const creativeCycles = new Map<string, number[]>();
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
      const points = [start, ...assignmentBoundaries.filter((boundary) => boundary > start && boundary < end), end];
      for (let index = 0; index < points.length - 1; index += 1) {
        const owner = assigneeAt(task, points[index]);
        if (!owner || !memberMetrics.has(owner)) continue;
        const duration = points[index + 1] - points[index];
        memberMetrics.get(owner)!.statusMs[entry.status] += duration;
        memberMetrics.get(owner)!.totalStatusMs += duration;
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

  const reworkTasks = tasks
    .map((task) => {
      const adjustment = summarizeStatusDurations(task.statusHistory, nowMs).find((item) => item.status === "ajuste");
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
    const base = { taskId: task.id, taskName: task.name, projectName: projectNames.get(task.projectId) || "Projeto removido" };
    if (NEEDS_LINK.has(task.status) && !task.driveLink) alerts.push({ ...base, id: `${task.id}:link`, type: "link", label: "Sem link do material", critical: task.status === "para_aprovacao" });
    if (!task.assigneeId) alerts.push({ ...base, id: `${task.id}:responsavel`, type: "responsavel", label: "Sem responsável", critical: false });
    if (!task.dueDate) alerts.push({ ...base, id: `${task.id}:prazo`, type: "prazo", label: "Sem data de entrega", critical: false });
    if (task.kind === "conteudo" && !task.formatTagIds.some((id) => tagKinds.get(id) === "formato")) alerts.push({ ...base, id: `${task.id}:formato`, type: "formato", label: "Sem formato", critical: false });
    if (task.kind === "conteudo" && !task.channelTagIds.some((id) => tagKinds.get(id) === "canal")) alerts.push({ ...base, id: `${task.id}:canal`, type: "canal", label: "Sem canal", critical: false });
  }
  alerts.sort((a, b) => Number(b.critical) - Number(a.critical) || a.projectName.localeCompare(b.projectName));

  const reschedules = tasks.flatMap((task): DashboardReschedule[] => {
    const changes = task.comments
      .filter((comment) => comment.kind === "activity" && comment.fieldKey === "dueDate")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!changes.length) return [];
    const originalDate = typeof changes[0].oldValue === "string" ? changes[0].oldValue.slice(0, 10) : undefined;
    const currentDate = task.dueDate || (typeof changes.at(-1)?.newValue === "string" ? String(changes.at(-1)?.newValue).slice(0, 10) : undefined);
    const closure = completedAt(task);
    return [{
      id: task.id,
      taskId: task.id,
      taskName: task.name,
      projectName: projectNames.get(task.projectId) || "Projeto removido",
      originalDate,
      currentDate,
      completedDate: closure === undefined ? undefined : new Date(closure).toISOString().slice(0, 10),
      changes: changes.length,
      movedDays: calendarDays(originalDate, currentDate),
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
    members: memberRows,
    slowestCreative: withCreativeCycles.sort((a, b) => (b.creativeAverageMs || 0) - (a.creativeAverageMs || 0))[0],
    mostLoaded: [...memberRows].sort((a, b) => b.openTasks - a.openTasks)[0],
    mostActive: [...memberRows].sort((a, b) => b.totalActivity - a.totalActivity)[0],
    topCommented,
    reworkTasks: reworkTasks.slice(0, 6),
    alerts,
    reschedules,
    delayBuckets,
    throughput,
  };
}
