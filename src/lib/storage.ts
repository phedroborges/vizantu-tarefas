import { isOverdue } from "./dates";
import { getSupabase } from "./supabase-client";
import type { AssistantConversation, AssistantMessage, KnowledgeDoc, Member, Project, StatusHistoryEntry, Tag, TagKind, Task, TaskStatus, UserRole } from "./types";

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

// PostgREST devolve {data, error} em toda chamada — throw no error deixa o
// resto do arquivo lidar só com o caminho feliz, igual antes fazia com fs.
// Devolve `unknown` de propósito: o cliente Supabase sem um Database type
// gerado não infere o formato da linha, então cada chamada faz seu próprio
// cast explícito pro Row correspondente.
function unwrap(result: { data: unknown; error: { message: string } | null }): unknown {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function sortByLocale<T>(items: T[], getValue: (item: T) => string): T[] {
  return [...items].sort((a, b) => getValue(a).localeCompare(getValue(b), "pt-BR"));
}

// ---------- Projetos ----------

type ProjectRow = { id: string; name: string; client: string | null; status: Project["status"]; created_at: string; updated_at: string };

function mapProject(row: ProjectRow): Project {
  return { id: row.id, name: row.name, client: row.client ?? undefined, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listProjects(): Promise<Project[]> {
  const rows = unwrap(await getSupabase().from("projects").select("*"));
  return sortByLocale((rows as ProjectRow[]).map(mapProject), (p) => p.name);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const row = unwrap(await getSupabase().from("projects").select("*").eq("id", id).maybeSingle());
  return row ? mapProject(row as ProjectRow) : undefined;
}

export async function createProject(input: { name: string; client?: string; status?: Project["status"] }): Promise<Project> {
  const now = nowIso();
  const row = unwrap(
    await getSupabase()
      .from("projects")
      .insert({ id: newId(), name: input.name.trim(), client: input.client?.trim() || null, status: input.status || "ativo", created_at: now, updated_at: now })
      .select()
      .single(),
  );
  return mapProject(row as ProjectRow);
}

export async function updateProject(id: string, patch: Partial<Pick<Project, "name" | "client" | "status">>): Promise<Project | undefined> {
  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.client !== undefined) update.client = patch.client.trim() || null;
  if (patch.status !== undefined) update.status = patch.status;
  const row = unwrap(await getSupabase().from("projects").update(update).eq("id", id).select().maybeSingle());
  return row ? mapProject(row as ProjectRow) : undefined;
}

export async function deleteProject(id: string): Promise<boolean> {
  // tasks.project_id tem "on delete cascade" no schema — apagar o projeto já
  // leva as tarefas dele junto, sem precisar de uma segunda chamada.
  const rows = unwrap(await getSupabase().from("projects").delete().eq("id", id).select("id"));
  return (rows as unknown[]).length > 0;
}

// ---------- Membros ----------

type MemberRow = {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  ai_enabled: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function mapMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? "",
    role: row.role,
    aiEnabled: row.ai_enabled,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMembers(): Promise<Member[]> {
  const rows = unwrap(await getSupabase().from("members").select("*"));
  return sortByLocale((rows as MemberRow[]).map(mapMember), (m) => m.name);
}

export async function getMember(id: string): Promise<Member | undefined> {
  const row = unwrap(await getSupabase().from("members").select("*").eq("id", id).maybeSingle());
  return row ? mapMember(row as MemberRow) : undefined;
}

// `id` é obrigatório: precisa ser o mesmo id do usuário já criado no Supabase
// Auth (supabase.auth.admin.createUser) — quem orquestra essa ordem é a rota
// de API (src/app/api/members/route.ts), não este módulo.
export async function createMember(input: { id: string; name: string; email: string; role: UserRole; aiEnabled: boolean }): Promise<Member> {
  const now = nowIso();
  const row = unwrap(
    await getSupabase()
      .from("members")
      .insert({
        id: input.id,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        role: input.role,
        ai_enabled: input.aiEnabled,
        active: true,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single(),
  );
  return mapMember(row as MemberRow);
}

export async function updateMember(
  id: string,
  patch: Partial<Pick<Member, "name" | "active" | "role" | "aiEnabled">>,
): Promise<Member | undefined> {
  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.role !== undefined) update.role = patch.role;
  if (patch.aiEnabled !== undefined) update.ai_enabled = patch.aiEnabled;
  const row = unwrap(await getSupabase().from("members").update(update).eq("id", id).select().maybeSingle());
  return row ? mapMember(row as MemberRow) : undefined;
}

// ---------- Acesso por projeto (só relevante pro papel "visualizador") ----------

export async function listProjectAccess(memberId: string): Promise<string[]> {
  const rows = unwrap(await getSupabase().from("project_access").select("project_id").eq("member_id", memberId)) as { project_id: string }[];
  return rows.map((r) => r.project_id);
}

// Usado pelo painel de usuários (dono) pra montar o mapa completo de acessos
// sem precisar de uma chamada por membro.
export async function listAllProjectAccess(): Promise<Record<string, string[]>> {
  const rows = unwrap(await getSupabase().from("project_access").select("member_id, project_id")) as { member_id: string; project_id: string }[];
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    (map[row.member_id] ??= []).push(row.project_id);
  }
  return map;
}

// Substitui todo o conjunto de acessos daquele membro — mais simples de
// raciocinar que um diff incremental, e a tabela é pequena o bastante pra
// apagar-e-reinserir não ser um problema de performance.
export async function setProjectAccess(memberId: string, projectIds: string[]): Promise<void> {
  const db = getSupabase();
  unwrap(await db.from("project_access").delete().eq("member_id", memberId));
  const uniqueIds = Array.from(new Set(projectIds.filter(Boolean)));
  if (uniqueIds.length) {
    unwrap(await db.from("project_access").insert(uniqueIds.map((projectId) => ({ member_id: memberId, project_id: projectId }))));
  }
}

// Sem deleteMember — desativação é o único caminho, pra tarefas antigas
// continuarem resolvendo o nome do responsável.

// ---------- Etiquetas (Formato / Canal) ----------

type TagRow = { id: string; kind: TagKind; label: string; created_at: string };

function mapTag(row: TagRow): Tag {
  return { id: row.id, kind: row.kind, label: row.label, createdAt: row.created_at };
}

function normalizeTagLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

export async function listTags(kind?: TagKind): Promise<Tag[]> {
  let query = getSupabase().from("tags").select("*");
  if (kind) query = query.eq("kind", kind);
  const rows = unwrap(await query);
  return sortByLocale((rows as TagRow[]).map(mapTag), (t) => t.label);
}

export async function createTag(input: { kind: TagKind; label: string }): Promise<Tag> {
  const label = normalizeTagLabel(input.label);
  // Dedupe por kind + label (case/acento-insensitive): o TagPicker chama
  // "criar" toda vez que o texto digitado não bate exatamente com o cache
  // local, então sem isso duplicaríamos a etiqueta a cada uso.
  const existingRows = unwrap(await getSupabase().from("tags").select("*").eq("kind", input.kind)) as TagRow[];
  const existing = existingRows.find((row) => row.label.localeCompare(label, "pt-BR", { sensitivity: "base" }) === 0);
  if (existing) return mapTag(existing);

  const row = unwrap(await getSupabase().from("tags").insert({ id: newId(), kind: input.kind, label, created_at: nowIso() }).select().single());
  return mapTag(row as TagRow);
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

type TaskRow = {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  assignee_id: string | null;
  description: string | null;
  drive_link: string | null;
  format_tag_ids: string[];
  channel_tag_ids: string[];
  status: TaskStatus;
  status_history: StatusHistoryEntry[];
  comments: Task["comments"];
  created_at: string;
  updated_at: string;
};

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    dueDate: row.due_date ?? undefined,
    assigneeId: row.assignee_id ?? undefined,
    description: row.description ?? undefined,
    driveLink: row.drive_link ?? undefined,
    formatTagIds: row.format_tag_ids ?? [],
    channelTagIds: row.channel_tag_ids ?? [],
    status: row.status,
    statusHistory: row.status_history ?? [],
    comments: row.comments ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
  const rows = unwrap(await getSupabase().from("tasks").select("*")) as TaskRow[];
  return rows.map(mapTask).sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
}

export async function getTask(id: string): Promise<Task | undefined> {
  const row = unwrap(await getSupabase().from("tasks").select("*").eq("id", id).maybeSingle());
  return row ? mapTask(row as TaskRow) : undefined;
}

export async function createTask(input: TaskInput): Promise<Task> {
  const now = nowIso();
  const status = input.status || "rascunho";
  const row = unwrap(
    await getSupabase()
      .from("tasks")
      .insert({
        id: newId(),
        project_id: input.projectId,
        name: input.name.trim(),
        due_date: input.dueDate || null,
        assignee_id: input.assigneeId || null,
        description: input.description?.trim() || null,
        drive_link: input.driveLink?.trim() || null,
        format_tag_ids: dedupeIds(input.formatTagIds ?? []),
        channel_tag_ids: dedupeIds(input.channelTagIds ?? []),
        status,
        status_history: openStatusHistory(status, now),
        comments: [],
        created_at: now,
        updated_at: now,
      })
      .select()
      .single(),
  );
  return mapTask(row as TaskRow);
}

export async function updateTask(
  id: string,
  patch: Partial<Omit<TaskInput, "assigneeId">> & { assigneeId?: string | null },
): Promise<Task | undefined> {
  const current = await getTask(id);
  if (!current) return undefined;

  // Trava de data: checar ANTES de qualquer mutação, contra o status EFETIVO
  // deste request (patch.status, se vier, senão o status atual) — assim um
  // único PATCH que muda o status pra "Aprovado" e corrige a data ao mesmo
  // tempo funciona em uma chamada só.
  if (patch.dueDate !== undefined && patch.dueDate !== current.dueDate) {
    const effectiveStatus = patch.status ?? current.status;
    if (isOverdue(current.dueDate, effectiveStatus)) throw new DueDateLockedError();
  }

  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.projectId !== undefined) update.project_id = patch.projectId;
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate || null;
  if (patch.assigneeId !== undefined) update.assignee_id = patch.assigneeId || null;
  if (patch.description !== undefined) update.description = patch.description.trim() || null;
  if (patch.driveLink !== undefined) update.drive_link = patch.driveLink.trim() || null;
  if (patch.formatTagIds !== undefined) update.format_tag_ids = dedupeIds(patch.formatTagIds);
  if (patch.channelTagIds !== undefined) update.channel_tag_ids = dedupeIds(patch.channelTagIds);

  if (patch.status !== undefined && patch.status !== current.status) {
    update.status = patch.status;
    update.status_history = transitionStatusHistory(current.statusHistory, patch.status, nowIso());
  }

  const row = unwrap(await getSupabase().from("tasks").update(update).eq("id", id).select().maybeSingle());
  return row ? mapTask(row as TaskRow) : undefined;
}

export async function deleteTask(id: string): Promise<boolean> {
  const rows = unwrap(await getSupabase().from("tasks").delete().eq("id", id).select("id"));
  return (rows as unknown[]).length > 0;
}

export async function addComment(taskId: string, input: { author: string; text: string }): Promise<Task | undefined> {
  const current = await getTask(taskId);
  if (!current) return undefined;
  const comments = [...current.comments, { id: newId(), author: input.author.trim() || "Equipe", text: input.text.trim(), createdAt: nowIso() }];
  const row = unwrap(await getSupabase().from("tasks").update({ comments, updated_at: nowIso() }).eq("id", taskId).select().maybeSingle());
  return row ? mapTask(row as TaskRow) : undefined;
}

// ---------- Base de conhecimento ----------

type KnowledgeDocRow = { id: string; title: string; content: string; created_at: string; updated_at: string };

function mapKnowledgeDoc(row: KnowledgeDocRow): KnowledgeDoc {
  return { id: row.id, title: row.title, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listKnowledgeDocs(): Promise<KnowledgeDoc[]> {
  const rows = unwrap(await getSupabase().from("knowledge_docs").select("*"));
  return sortByLocale((rows as KnowledgeDocRow[]).map(mapKnowledgeDoc), (d) => d.title);
}

export async function getKnowledgeDoc(id: string): Promise<KnowledgeDoc | undefined> {
  const row = unwrap(await getSupabase().from("knowledge_docs").select("*").eq("id", id).maybeSingle());
  return row ? mapKnowledgeDoc(row as KnowledgeDocRow) : undefined;
}

export async function createKnowledgeDoc(input: { title: string; content?: string }): Promise<KnowledgeDoc> {
  const now = nowIso();
  const row = unwrap(
    await getSupabase()
      .from("knowledge_docs")
      .insert({ id: newId(), title: input.title.trim(), content: input.content?.trim() || "", created_at: now, updated_at: now })
      .select()
      .single(),
  );
  return mapKnowledgeDoc(row as KnowledgeDocRow);
}

export async function updateKnowledgeDoc(id: string, patch: Partial<Pick<KnowledgeDoc, "title" | "content">>): Promise<KnowledgeDoc | undefined> {
  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.content !== undefined) update.content = patch.content.trim();
  const row = unwrap(await getSupabase().from("knowledge_docs").update(update).eq("id", id).select().maybeSingle());
  return row ? mapKnowledgeDoc(row as KnowledgeDocRow) : undefined;
}

export async function deleteKnowledgeDoc(id: string): Promise<boolean> {
  const rows = unwrap(await getSupabase().from("knowledge_docs").delete().eq("id", id).select("id"));
  return (rows as unknown[]).length > 0;
}

// ---------- Conversas do assistente (chat em tela cheia) ----------

const DEFAULT_CONVERSATION_TITLE = "Nova conversa";

type ConversationRow = { id: string; title: string; messages: AssistantMessage[]; created_at: string; updated_at: string };

function mapConversation(row: ConversationRow): AssistantConversation {
  return { id: row.id, title: row.title, messages: row.messages ?? [], createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listAssistantConversations(): Promise<AssistantConversation[]> {
  const rows = unwrap(await getSupabase().from("assistant_conversations").select("*").order("updated_at", { ascending: false }));
  return (rows as ConversationRow[]).map(mapConversation);
}

export async function getAssistantConversation(id: string): Promise<AssistantConversation | undefined> {
  const row = unwrap(await getSupabase().from("assistant_conversations").select("*").eq("id", id).maybeSingle());
  return row ? mapConversation(row as ConversationRow) : undefined;
}

export async function createAssistantConversation(): Promise<AssistantConversation> {
  const now = nowIso();
  const row = unwrap(
    await getSupabase()
      .from("assistant_conversations")
      .insert({ id: newId(), title: DEFAULT_CONVERSATION_TITLE, messages: [], created_at: now, updated_at: now })
      .select()
      .single(),
  );
  return mapConversation(row as ConversationRow);
}

export async function renameAssistantConversation(id: string, title: string): Promise<AssistantConversation | undefined> {
  const row = unwrap(
    await getSupabase()
      .from("assistant_conversations")
      .update({ title: title.trim() || DEFAULT_CONVERSATION_TITLE, updated_at: nowIso() })
      .eq("id", id)
      .select()
      .maybeSingle(),
  );
  return row ? mapConversation(row as ConversationRow) : undefined;
}

export async function deleteAssistantConversation(id: string): Promise<boolean> {
  const rows = unwrap(await getSupabase().from("assistant_conversations").delete().eq("id", id).select("id"));
  return (rows as unknown[]).length > 0;
}

// Título automático (estilo ChatGPT): a primeira mensagem do usuário vira o
// nome da conversa, enquanto ela ainda estiver com o título padrão — assim o
// usuário só precisa renomear manualmente se quiser algo diferente disso.
export async function appendAssistantMessages(id: string, newMessages: AssistantMessage[]): Promise<AssistantConversation | undefined> {
  const current = await getAssistantConversation(id);
  if (!current) return undefined;

  const messages = [...current.messages, ...newMessages];
  const isFirstUserMessage = current.messages.length === 0 && newMessages[0]?.role === "user";
  let title = current.title;
  if (isFirstUserMessage && current.title === DEFAULT_CONVERSATION_TITLE) {
    const firstText = newMessages[0].text.trim();
    title = firstText.length > 48 ? `${firstText.slice(0, 48).trim()}…` : firstText;
  }

  const row = unwrap(
    await getSupabase().from("assistant_conversations").update({ messages, title, updated_at: nowIso() }).eq("id", id).select().maybeSingle(),
  );
  return row ? mapConversation(row as ConversationRow) : undefined;
}
