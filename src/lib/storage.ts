import { promises as fs } from "fs";
import path from "path";
import { isOverdue } from "./dates";
import type { AssistantConversation, AssistantMessage, KnowledgeDoc, Member, Project, StatusHistoryEntry, Tag, TagKind, Task, TaskStatus } from "./types";

type Db = {
  projects: Project[];
  tasks: Task[];
  members: Member[];
  tags: Tag[];
  knowledgeDocs: KnowledgeDoc[];
  assistantConversations: AssistantConversation[];
};

const DB_PATH = path.join(process.cwd(), "data", "db.json");

let writeQueue: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

async function readDb(): Promise<Db> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Db>;
    return {
      projects: parsed.projects ?? [],
      tasks: parsed.tasks ?? [],
      members: parsed.members ?? [],
      tags: parsed.tags ?? [],
      knowledgeDocs: parsed.knowledgeDocs ?? [],
      assistantConversations: parsed.assistantConversations ?? [],
    };
  } catch {
    const empty: Db = { projects: [], tasks: [], members: [], tags: [], knowledgeDocs: [], assistantConversations: [] };
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
}

async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

// ---------- Projetos ----------

export async function listProjects(): Promise<Project[]> {
  const db = await readDb();
  return [...db.projects].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await readDb();
  return db.projects.find((project) => project.id === id);
}

export async function createProject(input: { name: string; client?: string; status?: Project["status"] }): Promise<Project> {
  return withWriteLock(async () => {
    const db = await readDb();
    const now = nowIso();
    const project: Project = {
      id: newId(),
      name: input.name.trim(),
      client: input.client?.trim() || undefined,
      status: input.status || "ativo",
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push(project);
    await writeDb(db);
    return project;
  });
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "client" | "status">>,
): Promise<Project | undefined> {
  return withWriteLock(async () => {
    const db = await readDb();
    const project = db.projects.find((item) => item.id === id);
    if (!project) return undefined;
    if (patch.name !== undefined) project.name = patch.name.trim();
    if (patch.client !== undefined) project.client = patch.client.trim() || undefined;
    if (patch.status !== undefined) project.status = patch.status;
    project.updatedAt = nowIso();
    await writeDb(db);
    return project;
  });
}

export async function deleteProject(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const db = await readDb();
    const before = db.projects.length;
    db.projects = db.projects.filter((project) => project.id !== id);
    db.tasks = db.tasks.filter((task) => task.projectId !== id);
    await writeDb(db);
    return db.projects.length < before;
  });
}

// ---------- Membros ----------

export async function listMembers(): Promise<Member[]> {
  const db = await readDb();
  return [...db.members].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function createMember(input: { name: string }): Promise<Member> {
  return withWriteLock(async () => {
    const db = await readDb();
    const now = nowIso();
    const member: Member = { id: newId(), name: input.name.trim(), active: true, createdAt: now, updatedAt: now };
    db.members.push(member);
    await writeDb(db);
    return member;
  });
}

export async function updateMember(
  id: string,
  patch: Partial<Pick<Member, "name" | "active">>,
): Promise<Member | undefined> {
  return withWriteLock(async () => {
    const db = await readDb();
    const member = db.members.find((item) => item.id === id);
    if (!member) return undefined;
    if (patch.name !== undefined) member.name = patch.name.trim();
    if (patch.active !== undefined) member.active = patch.active;
    member.updatedAt = nowIso();
    await writeDb(db);
    return member;
  });
}

// Sem deleteMember — desativação é o único caminho, pra tarefas antigas
// continuarem resolvendo o nome do responsável.

// ---------- Etiquetas (Formato / Canal) ----------

function normalizeTagLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

export async function listTags(kind?: TagKind): Promise<Tag[]> {
  const db = await readDb();
  const tags = kind ? db.tags.filter((tag) => tag.kind === kind) : db.tags;
  return [...tags].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export async function createTag(input: { kind: TagKind; label: string }): Promise<Tag> {
  return withWriteLock(async () => {
    const db = await readDb();
    const label = normalizeTagLabel(input.label);
    // Dedupe por kind + label (case-insensitive): o TagPicker chama "criar" toda
    // vez que o texto digitado não bate exatamente com o cache local, então sem
    // isso duplicaríamos a etiqueta a cada uso.
    const existing = db.tags.find(
      (tag) => tag.kind === input.kind && tag.label.localeCompare(label, "pt-BR", { sensitivity: "base" }) === 0,
    );
    if (existing) return existing;
    const tag: Tag = { id: newId(), kind: input.kind, label, createdAt: nowIso() };
    db.tags.push(tag);
    await writeDb(db);
    return tag;
  });
}

// Sem updateTag/deleteTag — fora do escopo desta fase (só criar e listar).

// ---------- Tarefas ----------

export class DueDateLockedError extends Error {
  constructor() {
    super("A tarefa está atrasada; a data de entrega não pode ser alterada.");
  }
}

export type TaskInput = {
  projectId: string;
  name: string;
  dueDate?: string;
  assigneeId?: string;
  description?: string;
  driveLink?: string;
  formatTagIds?: string[];
  channelTagIds?: string[];
  status?: TaskStatus;
};

function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

function openStatusHistory(status: TaskStatus, at: string): StatusHistoryEntry[] {
  return [{ status, enteredAt: at, exitedAt: null }];
}

// Fecha a entrada aberta (exitedAt === null) e cria uma nova entrada aberta pro
// próximo status. Funciona tanto pra avançar quanto pra voltar, e revisitar um
// status já visto vira uma entrada nova — assim a soma por status (ver
// summarizeStatusDurations em lib/dates.ts) acumula o tempo de todas as visitas.
function transitionStatusHistory(history: StatusHistoryEntry[], next: TaskStatus, at: string): StatusHistoryEntry[] {
  const copy = [...history];
  const openIndex = copy.findIndex((entry) => entry.exitedAt === null);
  if (openIndex !== -1) copy[openIndex] = { ...copy[openIndex], exitedAt: at };
  copy.push({ status: next, enteredAt: at, exitedAt: null });
  return copy;
}

export async function listTasks(): Promise<Task[]> {
  const db = await readDb();
  return [...db.tasks].sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
}

export async function getTask(id: string): Promise<Task | undefined> {
  const db = await readDb();
  return db.tasks.find((task) => task.id === id);
}

export async function createTask(input: TaskInput): Promise<Task> {
  return withWriteLock(async () => {
    const db = await readDb();
    const now = nowIso();
    const status = input.status || "rascunho";
    const task: Task = {
      id: newId(),
      projectId: input.projectId,
      name: input.name.trim(),
      dueDate: input.dueDate || undefined,
      assigneeId: input.assigneeId || undefined,
      description: input.description?.trim() || undefined,
      driveLink: input.driveLink?.trim() || undefined,
      formatTagIds: dedupeIds(input.formatTagIds ?? []),
      channelTagIds: dedupeIds(input.channelTagIds ?? []),
      status,
      statusHistory: openStatusHistory(status, now),
      comments: [],
      createdAt: now,
      updatedAt: now,
    };
    db.tasks.push(task);
    await writeDb(db);
    return task;
  });
}

export async function updateTask(
  id: string,
  patch: Partial<Omit<TaskInput, "assigneeId">> & { assigneeId?: string | null },
): Promise<Task | undefined> {
  return withWriteLock(async () => {
    const db = await readDb();
    const task = db.tasks.find((item) => item.id === id);
    if (!task) return undefined;

    // Trava de data (item 8): checar ANTES de qualquer mutação, contra o status
    // EFETIVO deste request (patch.status, se vier, senão o status atual) — assim
    // um único PATCH que muda o status pra "Aprovado" e corrige a data ao mesmo
    // tempo funciona em uma chamada só.
    if (patch.dueDate !== undefined && patch.dueDate !== task.dueDate) {
      const effectiveStatus = patch.status ?? task.status;
      if (isOverdue(task.dueDate, effectiveStatus)) throw new DueDateLockedError();
    }

    if (patch.projectId !== undefined) task.projectId = patch.projectId;
    if (patch.name !== undefined) task.name = patch.name.trim();
    if (patch.dueDate !== undefined) task.dueDate = patch.dueDate || undefined;
    if (patch.assigneeId !== undefined) task.assigneeId = patch.assigneeId || undefined;
    if (patch.description !== undefined) task.description = patch.description.trim() || undefined;
    if (patch.driveLink !== undefined) task.driveLink = patch.driveLink.trim() || undefined;
    if (patch.formatTagIds !== undefined) task.formatTagIds = dedupeIds(patch.formatTagIds);
    if (patch.channelTagIds !== undefined) task.channelTagIds = dedupeIds(patch.channelTagIds);

    if (patch.status !== undefined && patch.status !== task.status) {
      const now = nowIso();
      task.statusHistory = transitionStatusHistory(task.statusHistory, patch.status, now);
      task.status = patch.status;
    }

    task.updatedAt = nowIso();
    await writeDb(db);
    return task;
  });
}

export async function deleteTask(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const db = await readDb();
    const before = db.tasks.length;
    db.tasks = db.tasks.filter((task) => task.id !== id);
    await writeDb(db);
    return db.tasks.length < before;
  });
}

export async function addComment(taskId: string, input: { author: string; text: string }): Promise<Task | undefined> {
  return withWriteLock(async () => {
    const db = await readDb();
    const task = db.tasks.find((item) => item.id === taskId);
    if (!task) return undefined;
    task.comments.push({
      id: newId(),
      author: input.author.trim() || "Equipe",
      text: input.text.trim(),
      createdAt: nowIso(),
    });
    task.updatedAt = nowIso();
    await writeDb(db);
    return task;
  });
}

// ---------- Base de conhecimento ----------

export async function listKnowledgeDocs(): Promise<KnowledgeDoc[]> {
  const db = await readDb();
  return [...db.knowledgeDocs].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

export async function getKnowledgeDoc(id: string): Promise<KnowledgeDoc | undefined> {
  const db = await readDb();
  return db.knowledgeDocs.find((doc) => doc.id === id);
}

export async function createKnowledgeDoc(input: { title: string; content?: string }): Promise<KnowledgeDoc> {
  return withWriteLock(async () => {
    const db = await readDb();
    const now = nowIso();
    const doc: KnowledgeDoc = {
      id: newId(),
      title: input.title.trim(),
      content: input.content?.trim() || "",
      createdAt: now,
      updatedAt: now,
    };
    db.knowledgeDocs.push(doc);
    await writeDb(db);
    return doc;
  });
}

export async function updateKnowledgeDoc(id: string, patch: Partial<Pick<KnowledgeDoc, "title" | "content">>): Promise<KnowledgeDoc | undefined> {
  return withWriteLock(async () => {
    const db = await readDb();
    const doc = db.knowledgeDocs.find((item) => item.id === id);
    if (!doc) return undefined;
    if (patch.title !== undefined) doc.title = patch.title.trim();
    if (patch.content !== undefined) doc.content = patch.content.trim();
    doc.updatedAt = nowIso();
    await writeDb(db);
    return doc;
  });
}

export async function deleteKnowledgeDoc(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const db = await readDb();
    const before = db.knowledgeDocs.length;
    db.knowledgeDocs = db.knowledgeDocs.filter((doc) => doc.id !== id);
    await writeDb(db);
    return db.knowledgeDocs.length < before;
  });
}

// ---------- Conversas do assistente (chat em tela cheia) ----------

const DEFAULT_CONVERSATION_TITLE = "Nova conversa";

export async function listAssistantConversations(): Promise<AssistantConversation[]> {
  const db = await readDb();
  return [...db.assistantConversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getAssistantConversation(id: string): Promise<AssistantConversation | undefined> {
  const db = await readDb();
  return db.assistantConversations.find((conversation) => conversation.id === id);
}

export async function createAssistantConversation(): Promise<AssistantConversation> {
  return withWriteLock(async () => {
    const db = await readDb();
    const now = nowIso();
    const conversation: AssistantConversation = { id: newId(), title: DEFAULT_CONVERSATION_TITLE, messages: [], createdAt: now, updatedAt: now };
    db.assistantConversations.unshift(conversation);
    await writeDb(db);
    return conversation;
  });
}

export async function renameAssistantConversation(id: string, title: string): Promise<AssistantConversation | undefined> {
  return withWriteLock(async () => {
    const db = await readDb();
    const conversation = db.assistantConversations.find((item) => item.id === id);
    if (!conversation) return undefined;
    conversation.title = title.trim() || DEFAULT_CONVERSATION_TITLE;
    conversation.updatedAt = nowIso();
    await writeDb(db);
    return conversation;
  });
}

export async function deleteAssistantConversation(id: string): Promise<boolean> {
  return withWriteLock(async () => {
    const db = await readDb();
    const before = db.assistantConversations.length;
    db.assistantConversations = db.assistantConversations.filter((conversation) => conversation.id !== id);
    await writeDb(db);
    return db.assistantConversations.length < before;
  });
}

// Título automático (estilo ChatGPT): a primeira mensagem do usuário vira o
// nome da conversa, enquanto ela ainda estiver com o título padrão — assim o
// usuário só precisa renomear manualmente se quiser algo diferente disso.
export async function appendAssistantMessages(id: string, newMessages: AssistantMessage[]): Promise<AssistantConversation | undefined> {
  return withWriteLock(async () => {
    const db = await readDb();
    const conversation = db.assistantConversations.find((item) => item.id === id);
    if (!conversation) return undefined;
    const isFirstUserMessage = conversation.messages.length === 0 && newMessages[0]?.role === "user";
    conversation.messages.push(...newMessages);
    if (isFirstUserMessage && conversation.title === DEFAULT_CONVERSATION_TITLE) {
      const firstText = newMessages[0].text.trim();
      conversation.title = firstText.length > 48 ? `${firstText.slice(0, 48).trim()}…` : firstText;
    }
    conversation.updatedAt = nowIso();
    await writeDb(db);
    return conversation;
  });
}
