import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { formatDuration, isOverdue, summarizeStatusDurations, todayIso } from "./dates";
import {
  createTag,
  createTask,
  getTask,
  listMembers,
  listProjects,
  listTags,
  listTasks,
  updateTask,
  DueDateLockedError,
} from "./storage";
import { DONE_STATUSES, TASK_STATUSES, type Member, type Project, type TagKind, type Task, type TaskStatus } from "./types";

// Marcador especial: quando o modelo pede pra excluir uma tarefa, NÃO apagamos
// aqui — devolvemos isso pro endpoint decidir cortar o loop e pedir confirmação
// na UI, sem gastar tokens numa segunda chamada à OpenAI.
export class PendingDeleteConfirmation {
  constructor(
    public taskId: string,
    public taskName: string,
  ) {}
}

function statusLabel(status: TaskStatus): string {
  return TASK_STATUSES.find((item) => item.value === status)?.label || status;
}

function findByName<T extends { id: string }>(items: T[], name: string, getName: (item: T) => string): T | undefined {
  const normalized = name.trim().toLowerCase();
  return (
    items.find((item) => getName(item).toLowerCase() === normalized) ||
    items.find((item) => getName(item).toLowerCase().includes(normalized))
  );
}

async function resolveProjectId(projectName: string | undefined, projects: Project[]): Promise<string | undefined> {
  if (!projectName) return undefined;
  return findByName(projects, projectName, (p) => p.name)?.id;
}

async function resolveAssigneeId(assigneeName: string | undefined, members: Member[]): Promise<string | undefined> {
  if (!assigneeName) return undefined;
  return findByName(members, assigneeName, (m) => m.name)?.id;
}

async function resolveTagIds(labels: string[] | undefined, kind: TagKind): Promise<string[]> {
  if (!labels?.length) return [];
  const catalog = await listTags(kind);
  const ids: string[] = [];
  for (const label of labels) {
    const existing = findByName(catalog, label, (t) => t.label);
    if (existing) {
      ids.push(existing.id);
    } else {
      const created = await createTag({ kind, label });
      catalog.push(created);
      ids.push(created.id);
    }
  }
  return ids;
}

function summarizeTask(task: Task, projectById: Map<string, Project>, memberById: Map<string, Member>) {
  return {
    id: task.id,
    name: task.name,
    project: projectById.get(task.projectId)?.name || "Sem projeto",
    assignee: task.assigneeId ? memberById.get(task.assigneeId)?.name || null : null,
    status: statusLabel(task.status),
    dueDate: task.dueDate || null,
    overdue: isOverdue(task.dueDate, task.status),
  };
}

async function loadContext() {
  const [tasks, projects, members] = await Promise.all([listTasks(), listProjects(), listMembers()]);
  return {
    tasks,
    projects,
    members,
    projectById: new Map(projects.map((p) => [p.id, p])),
    memberById: new Map(members.map((m) => [m.id, m])),
  };
}

// ---------- Implementações ----------

async function toolListTasks(args: { projectName?: string; assigneeName?: string; status?: string; overdueOnly?: boolean }) {
  const { tasks, projects, members, projectById, memberById } = await loadContext();
  const projectId = await resolveProjectId(args.projectName, projects);
  const assigneeId = await resolveAssigneeId(args.assigneeName, members);
  const statusValue = TASK_STATUSES.find((item) => item.value === args.status || item.label.toLowerCase() === args.status?.toLowerCase())?.value;

  const filtered = tasks.filter((task) => {
    if (projectId && task.projectId !== projectId) return false;
    if (assigneeId && task.assigneeId !== assigneeId) return false;
    if (statusValue && task.status !== statusValue) return false;
    if (args.overdueOnly && !isOverdue(task.dueDate, task.status)) return false;
    return true;
  });

  return { count: filtered.length, tasks: filtered.map((task) => summarizeTask(task, projectById, memberById)) };
}

async function toolGetTask(args: { taskId: string }) {
  const task = await getTask(args.taskId);
  if (!task) return { error: "Tarefa não encontrada." };
  const [formatTags, channelTags, { projectById, memberById }] = await Promise.all([listTags("formato"), listTags("canal"), loadContext()]);
  const formatTagById = new Map(formatTags.map((t) => [t.id, t]));
  const channelTagById = new Map(channelTags.map((t) => [t.id, t]));
  const durations = summarizeStatusDurations(task.statusHistory).map((entry) => ({
    status: statusLabel(entry.status),
    duration: formatDuration(entry.totalMs),
    visits: entry.visits,
  }));

  return {
    ...summarizeTask(task, projectById, memberById),
    description: task.description || null,
    driveLink: task.driveLink || null,
    formats: task.formatTagIds.map((id) => formatTagById.get(id)?.label).filter(Boolean),
    channels: task.channelTagIds.map((id) => channelTagById.get(id)?.label).filter(Boolean),
    comments: task.comments.map((c) => ({ author: c.author, text: c.text, createdAt: c.createdAt })),
    timeByStatus: durations,
  };
}

async function toolCreateTask(args: {
  name: string;
  projectName: string;
  assigneeName?: string;
  dueDate?: string;
  formatLabels?: string[];
  channelLabels?: string[];
  description?: string;
  status?: string;
}) {
  const { projects, members, projectById, memberById } = await loadContext();
  const projectId = await resolveProjectId(args.projectName, projects);
  if (!projectId) return { error: `Projeto "${args.projectName}" não encontrado. Projetos existentes: ${projects.map((p) => p.name).join(", ")}` };
  const assigneeId = await resolveAssigneeId(args.assigneeName, members);
  const formatTagIds = await resolveTagIds(args.formatLabels, "formato");
  const channelTagIds = await resolveTagIds(args.channelLabels, "canal");
  const status = TASK_STATUSES.find((item) => item.value === args.status)?.value;

  const task = await createTask({
    name: args.name,
    projectId,
    assigneeId,
    dueDate: args.dueDate,
    description: args.description,
    formatTagIds,
    channelTagIds,
    status,
  });
  return { created: summarizeTask(task, projectById, memberById) };
}

async function toolUpdateTask(args: {
  taskId: string;
  name?: string;
  assigneeName?: string;
  dueDate?: string;
  formatLabels?: string[];
  channelLabels?: string[];
  description?: string;
  status?: string;
}) {
  const { members, projectById, memberById } = await loadContext();
  const patch: Parameters<typeof updateTask>[1] = {};
  if (args.name !== undefined) patch.name = args.name;
  if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
  if (args.description !== undefined) patch.description = args.description;
  if (args.assigneeName !== undefined) patch.assigneeId = await resolveAssigneeId(args.assigneeName, members);
  if (args.formatLabels !== undefined) patch.formatTagIds = await resolveTagIds(args.formatLabels, "formato");
  if (args.channelLabels !== undefined) patch.channelTagIds = await resolveTagIds(args.channelLabels, "canal");
  if (args.status !== undefined) {
    const status = TASK_STATUSES.find((item) => item.value === args.status || item.label.toLowerCase() === args.status?.toLowerCase())?.value;
    if (!status) return { error: `Status "${args.status}" inválido. Use um de: ${TASK_STATUSES.map((s) => s.label).join(", ")}` };
    patch.status = status;
  }

  try {
    const task = await updateTask(args.taskId, patch);
    if (!task) return { error: "Tarefa não encontrada." };
    return { updated: summarizeTask(task, projectById, memberById) };
  } catch (error) {
    if (error instanceof DueDateLockedError) return { error: error.message };
    throw error;
  }
}

async function toolDeleteTask(args: { taskId: string }) {
  const task = await getTask(args.taskId);
  if (!task) return { error: "Tarefa não encontrada." };
  return new PendingDeleteConfirmation(task.id, task.name);
}

async function toolGetDeadlinesSummary(args: { withinDays?: number }) {
  const { tasks, projectById, memberById } = await loadContext();
  const withinDays = args.withinDays ?? 7;
  const today = todayIso();
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + withinDays);
  const limit = limitDate.toISOString().slice(0, 10);

  const overdue = tasks.filter((task) => isOverdue(task.dueDate, task.status));
  const upcoming = tasks.filter(
    (task) => task.dueDate && !isOverdue(task.dueDate, task.status) && task.dueDate >= today && task.dueDate <= limit && !DONE_STATUSES.includes(task.status),
  );

  return {
    overdue: overdue.map((task) => summarizeTask(task, projectById, memberById)),
    upcoming: upcoming.map((task) => summarizeTask(task, projectById, memberById)),
  };
}

async function toolListProjects() {
  const projects = await listProjects();
  return { projects: projects.map((p) => ({ name: p.name, client: p.client || null, status: p.status })) };
}

async function toolListMembers() {
  const members = await listMembers();
  return { members: members.filter((m) => m.active).map((m) => m.name) };
}

// ---------- Schemas (OpenAI tool calling) ----------

export const ASSISTANT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "Lista tarefas, opcionalmente filtradas por projeto, responsável, status ou apenas atrasadas.",
      parameters: {
        type: "object",
        properties: {
          projectName: { type: "string", description: "Nome (ou parte do nome) do projeto." },
          assigneeName: { type: "string", description: "Nome do responsável." },
          status: { type: "string", description: "Um dos status: " + TASK_STATUSES.map((s) => s.label).join(", ") },
          overdueOnly: { type: "boolean", description: "Se true, retorna só tarefas atrasadas." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_task",
      description: "Detalhe completo de uma tarefa (descrição, comentários, tempo em cada status).",
      parameters: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Cria uma nova tarefa.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          projectName: { type: "string", description: "Nome do projeto ao qual a tarefa pertence (obrigatório)." },
          assigneeName: { type: "string" },
          dueDate: { type: "string", description: "Data no formato AAAA-MM-DD." },
          formatLabels: { type: "array", items: { type: "string" }, description: "Ex.: Vídeo, Carrossel. Cria a etiqueta se não existir." },
          channelLabels: { type: "array", items: { type: "string" }, description: "Ex.: Instagram, YouTube. Cria a etiqueta se não existir." },
          description: { type: "string" },
          status: { type: "string", description: "Um dos: " + TASK_STATUSES.map((s) => s.value).join(", ") },
        },
        required: ["name", "projectName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Edita campos de uma tarefa existente (nome, responsável, prazo, formato, canal, descrição, status).",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          name: { type: "string" },
          assigneeName: { type: "string" },
          dueDate: { type: "string" },
          formatLabels: { type: "array", items: { type: "string" } },
          channelLabels: { type: "array", items: { type: "string" } },
          description: { type: "string" },
          status: { type: "string" },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Solicita a exclusão de uma tarefa. Isso NÃO apaga direto — o usuário precisa confirmar na interface antes.",
      parameters: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_deadlines_summary",
      description: "Resumo de tarefas atrasadas e com prazo próximo (padrão: próximos 7 dias).",
      parameters: { type: "object", properties: { withinDays: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: { name: "list_projects", description: "Lista todos os projetos cadastrados.", parameters: { type: "object", properties: {} } },
  },
  {
    type: "function",
    function: { name: "list_members", description: "Lista os membros ativos do time.", parameters: { type: "object", properties: {} } },
  },
];

export async function executeTool(name: string, rawArgs: string): Promise<unknown> {
  const args = rawArgs ? JSON.parse(rawArgs) : {};
  switch (name) {
    case "list_tasks":
      return toolListTasks(args);
    case "get_task":
      return toolGetTask(args);
    case "create_task":
      return toolCreateTask(args);
    case "update_task":
      return toolUpdateTask(args);
    case "delete_task":
      return toolDeleteTask(args);
    case "get_deadlines_summary":
      return toolGetDeadlinesSummary(args);
    case "list_projects":
      return toolListProjects();
    case "list_members":
      return toolListMembers();
    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}
