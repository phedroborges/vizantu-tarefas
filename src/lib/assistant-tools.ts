import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { formatDuration, isOverdue, summarizeStatusDurations, todayIso } from "./dates";
import {
  addComment,
  createKnowledgeDoc,
  createTag,
  createTask,
  getTask,
  listKnowledgeDocs,
  listMembers,
  listProjects,
  listTags,
  listTasks,
  updateKnowledgeDoc,
  updateTask,
  DueDateLockedError,
} from "./storage";
import type { CurrentUser } from "./current-user";
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

// Escopa tasks/projects pelo acesso do caller (dono/editor = "all", sem
// filtro; visualizador = só os projetos liberados) — um só lugar pra isso,
// então list_tasks/create_task/update_task/get_deadlines_summary/list_projects
// ganham escopo de graça só recebendo `caller`.
async function loadContext(caller: CurrentUser) {
  const [allTasks, allProjects, members] = await Promise.all([listTasks(), listProjects(), listMembers()]);
  const projects =
    caller.accessibleProjectIds === "all" ? allProjects : allProjects.filter((p) => (caller.accessibleProjectIds as string[]).includes(p.id));
  const visibleProjectIds = new Set(projects.map((p) => p.id));
  const tasks = caller.accessibleProjectIds === "all" ? allTasks : allTasks.filter((t) => visibleProjectIds.has(t.projectId));
  return {
    tasks,
    projects,
    members,
    projectById: new Map(projects.map((p) => [p.id, p])),
    memberById: new Map(members.map((m) => [m.id, m])),
  };
}

// ---------- Implementações ----------

async function toolListTasks(
  args: { query?: string; projectName?: string; assigneeName?: string; status?: string; overdueOnly?: boolean },
  caller: CurrentUser,
) {
  const { tasks, projects, members, projectById, memberById } = await loadContext(caller);
  const projectId = await resolveProjectId(args.projectName, projects);
  const assigneeId = await resolveAssigneeId(args.assigneeName, members);
  const statusValue = TASK_STATUSES.find((item) => item.value === args.status || item.label.toLowerCase() === args.status?.toLowerCase())?.value;
  const nameQuery = args.query?.trim().toLowerCase();

  const filtered = tasks.filter((task) => {
    if (projectId && task.projectId !== projectId) return false;
    if (assigneeId && task.assigneeId !== assigneeId) return false;
    if (statusValue && task.status !== statusValue) return false;
    if (args.overdueOnly && !isOverdue(task.dueDate, task.status)) return false;
    if (nameQuery && !task.name.toLowerCase().includes(nameQuery)) return false;
    return true;
  });

  return { count: filtered.length, tasks: filtered.map((task) => summarizeTask(task, projectById, memberById)) };
}

async function toolGetTask(args: { taskId: string }, caller: CurrentUser) {
  const task = await getTask(args.taskId);
  if (!task) return { error: "Tarefa não encontrada." };
  if (caller.accessibleProjectIds !== "all" && !caller.accessibleProjectIds.includes(task.projectId)) {
    return { error: "Essa tarefa está fora do seu acesso." };
  }
  const [formatTags, channelTags, { projectById, memberById }] = await Promise.all([listTags("formato"), listTags("canal"), loadContext(caller)]);
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

async function toolCreateTask(
  args: {
    name: string;
    projectName: string;
    assigneeName?: string;
    dueDate?: string;
    formatLabels?: string[];
    channelLabels?: string[];
    description?: string;
    status?: string;
  },
  caller: CurrentUser,
) {
  const { projects, members, projectById, memberById } = await loadContext(caller);
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

const CLEAR_ASSIGNEE_WORDS = ["ninguém", "ninguem", "nenhum", "sem responsável", "sem responsavel", "remover responsável", "remover responsavel"];

async function toolUpdateTask(
  args: {
    taskId: string;
    name?: string;
    projectName?: string;
    assigneeName?: string;
    dueDate?: string;
    formatLabels?: string[];
    channelLabels?: string[];
    description?: string;
    driveLink?: string;
    status?: string;
  },
  caller: CurrentUser,
) {
  const { projects, members, projectById, memberById } = await loadContext(caller);
  const patch: Parameters<typeof updateTask>[1] = {};
  if (args.name !== undefined) patch.name = args.name;
  if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
  if (args.description !== undefined) patch.description = args.description;
  if (args.driveLink !== undefined) patch.driveLink = args.driveLink;
  if (args.projectName !== undefined) {
    const projectId = await resolveProjectId(args.projectName, projects);
    if (!projectId) return { error: `Projeto "${args.projectName}" não encontrado. Projetos existentes: ${projects.map((p) => p.name).join(", ")}` };
    patch.projectId = projectId;
  }
  if (args.assigneeName !== undefined) {
    if (CLEAR_ASSIGNEE_WORDS.includes(args.assigneeName.trim().toLowerCase())) {
      patch.assigneeId = null;
    } else {
      const assigneeId = await resolveAssigneeId(args.assigneeName, members);
      if (!assigneeId) return { error: `Responsável "${args.assigneeName}" não encontrado. Membros ativos: ${members.filter((m) => m.active).map((m) => m.name).join(", ")}` };
      patch.assigneeId = assigneeId;
    }
  }
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

async function toolAddComment(args: { taskId: string; text: string; author?: string }) {
  const task = await addComment(args.taskId, { author: args.author || "IA Vizantu", text: args.text });
  if (!task) return { error: "Tarefa não encontrada." };
  return { ok: true, taskName: task.name, totalComments: task.comments.length };
}

async function toolListKnowledgeDocs() {
  const docs = await listKnowledgeDocs();
  return { docs: docs.map((doc) => ({ id: doc.id, title: doc.title, documented: Boolean(doc.content) })) };
}

// Recorta um trecho em volta da primeira ocorrência do termo — devolver o
// documento inteiro pra "ver se é relevante" seria o oposto de economizar
// tokens, que é exatamente o problema que essa ferramenta existe pra evitar.
function snippetAround(content: string, term: string, radius = 90): string {
  const idx = content.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return content.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(content.length, idx + term.length + radius);
  return `${start > 0 ? "…" : ""}${content.slice(start, end).trim()}${end < content.length ? "…" : ""}`;
}

// Busca local (sem custo de IA): pontua por palavra-chave no título (peso
// maior) e no conteúdo (peso menor), devolvendo só um TRECHO de cada
// documento relevante — nunca o conteúdo inteiro. Isso é o que permite a base
// crescer com muitos documentos sem o modelo precisar abrir um por um "só pra
// ver": ele vê os trechos, decide o que de fato importa, e só aí chama
// get_knowledge_doc no(s) documento(s) certo(s).
async function toolSearchKnowledgeDocs(args: { query: string }) {
  const docs = await listKnowledgeDocs();
  const terms = args.query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
  if (!terms.length) return { results: [] };

  const scored = docs
    .map((doc) => {
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();
      let score = 0;
      let firstMatch: string | undefined;
      for (const term of terms) {
        if (titleLower.includes(term)) score += 3;
        if (contentLower.includes(term)) {
          score += 1;
          firstMatch ||= term;
        }
      }
      return { doc, score, firstMatch };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (!scored.length) {
    return { results: [], hint: "Nenhum documento bateu com essas palavras-chave. Use list_knowledge_docs se quiser ver todos os títulos." };
  }

  return {
    results: scored.map(({ doc, firstMatch }) => ({
      title: doc.title,
      snippet: doc.content ? snippetAround(doc.content, firstMatch || doc.title, 90) : "(documento ainda sem conteúdo)",
    })),
  };
}

async function toolGetKnowledgeDoc(args: { title: string }) {
  const docs = await listKnowledgeDocs();
  const doc = findByName(docs, args.title, (d) => d.title);
  if (!doc) return { error: `Nenhum documento encontrado com o título "${args.title}". Use list_knowledge_docs para ver os títulos existentes.` };
  return { id: doc.id, title: doc.title, content: doc.content || null };
}

async function toolUpsertKnowledgeDoc(args: { title: string; content: string }) {
  const docs = await listKnowledgeDocs();
  const existing = findByName(docs, args.title, (d) => d.title);
  if (existing) {
    const updated = await updateKnowledgeDoc(existing.id, { content: args.content });
    return { saved: { id: updated!.id, title: updated!.title }, created: false };
  }
  const created = await createKnowledgeDoc({ title: args.title, content: args.content });
  return { saved: { id: created.id, title: created.title }, created: true };
}

async function toolGetDeadlinesSummary(args: { withinDays?: number }, caller: CurrentUser) {
  const { tasks, projectById, memberById } = await loadContext(caller);
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

async function toolListProjects(caller: CurrentUser) {
  const { projects } = await loadContext(caller);
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
      description:
        "Lista tarefas, opcionalmente filtradas por trecho do nome/título, projeto, responsável, status ou apenas atrasadas. Combine filtros à vontade.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Trecho do NOME/TÍTULO da tarefa (busca por substring, não precisa ser exato). Use isso quando o usuário descrever a tarefa por palavras do título dela — NÃO confunda com 'status': status é só um dos 12 valores do pipeline (Rascunho, Revisão, Aprovado etc.), nunca uma palavra que aparece dentro do título.",
          },
          projectName: { type: "string", description: "Nome (ou parte do nome) do projeto." },
          assigneeName: { type: "string", description: "Nome do responsável." },
          status: { type: "string", description: "Um dos status do pipeline: " + TASK_STATUSES.map((s) => s.label).join(", ") },
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
      description:
        "Edita QUALQUER campo de uma tarefa existente: nome, projeto, responsável, prazo, formato, canal, link do drive, descrição/roteiro e status. Envie só os campos que devem mudar.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          name: { type: "string", description: "Novo nome da tarefa." },
          projectName: { type: "string", description: "Nome do projeto para mover a tarefa para lá." },
          assigneeName: { type: "string", description: "Nome do novo responsável, ou 'ninguém'/'sem responsável' para remover." },
          dueDate: { type: "string", description: "Nova data de entrega no formato AAAA-MM-DD." },
          formatLabels: { type: "array", items: { type: "string" }, description: "Substitui os formatos da tarefa por esta lista." },
          channelLabels: { type: "array", items: { type: "string" }, description: "Substitui os canais da tarefa por esta lista." },
          description: { type: "string", description: "Novo texto do briefing/roteiro da tarefa." },
          driveLink: { type: "string", description: "Nova URL do arquivo no Drive." },
          status: { type: "string", description: "Um dos: " + TASK_STATUSES.map((s) => s.label).join(", ") },
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
      name: "add_comment",
      description: "Adiciona um comentário no histórico de uma tarefa.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          text: { type: "string", description: "Texto do comentário." },
          author: { type: "string", description: "Autor do comentário (opcional; padrão 'IA Vizantu')." },
        },
        required: ["taskId", "text"],
      },
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
  {
    type: "function",
    function: {
      name: "search_knowledge_docs",
      description:
        "Busca por palavras-chave em título E conteúdo da base de conhecimento e devolve só um TRECHO de cada documento relevante — não o conteúdo inteiro. Use como alternativa a list_knowledge_docs quando os títulos sozinhos não deixarem claro qual documento responde à pergunta, ou quando a instrução do sistema disser para preferir busca em vez de listar tudo.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Palavras-chave da pergunta do usuário." } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_knowledge_docs",
      description:
        "Lista só os TÍTULOS de todos os documentos da base de conhecimento, sem conteúdo (barato). Use seu próprio entendimento do significado de cada título pra decidir qual abrir — não precisa bater palavra por palavra. A instrução do sistema diz quando preferir isso ou search_knowledge_docs, dependendo de quantos documentos existem.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_knowledge_doc",
      description:
        "Abre o conteúdo COMPLETO de um único documento pelo título exato. Só chame isso depois de search_knowledge_docs (ou list_knowledge_docs) confirmar qual documento é o certo — nunca abra vários documentos 'só para ver', isso gasta tokens à toa.",
      parameters: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
    },
  },
  {
    type: "function",
    function: {
      name: "upsert_knowledge_doc",
      description:
        "Cria ou atualiza (se já existir um com título parecido) um documento da base de conhecimento com o conteúdo combinado com o usuário na conversa.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string", description: "Conteúdo completo do documento (substitui o conteúdo anterior, se houver)." },
        },
        required: ["title", "content"],
      },
    },
  },
];

// Ferramentas que alteram dado — bloqueadas de vez pra "visualizador" antes
// mesmo de decidir qual é (um guard só, não um if por função).
const MUTATING_TOOLS = new Set(["create_task", "update_task", "delete_task", "add_comment", "upsert_knowledge_doc"]);

export async function executeTool(name: string, rawArgs: string, caller: CurrentUser): Promise<unknown> {
  if (MUTATING_TOOLS.has(name) && caller.role === "visualizador") {
    return { error: "Seu acesso é somente leitura — peça a um editor ou dono do time pra fazer essa alteração." };
  }
  const args = rawArgs ? JSON.parse(rawArgs) : {};
  switch (name) {
    case "list_tasks":
      return toolListTasks(args, caller);
    case "get_task":
      return toolGetTask(args, caller);
    case "create_task":
      return toolCreateTask(args, caller);
    case "update_task":
      return toolUpdateTask(args, caller);
    case "delete_task":
      return toolDeleteTask(args);
    case "add_comment":
      return toolAddComment(args);
    case "get_deadlines_summary":
      return toolGetDeadlinesSummary(args, caller);
    case "list_projects":
      return toolListProjects(caller);
    case "list_members":
      return toolListMembers();
    case "search_knowledge_docs":
      return toolSearchKnowledgeDocs(args);
    case "list_knowledge_docs":
      return toolListKnowledgeDocs();
    case "get_knowledge_doc":
      return toolGetKnowledgeDoc(args);
    case "upsert_knowledge_doc":
      return toolUpsertKnowledgeDoc(args);
    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}
