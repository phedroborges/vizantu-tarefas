import { isOverdue } from "./dates";
import { getSupabase } from "./supabase-client";
import { DEFAULT_STATUS_COLORS, TASK_STATUSES } from "./types";
import type {
  Announcement,
  AnnouncementScope,
  AssistantConversation,
  AssistantMessage,
  ClientSatisfactionScore,
  KnowledgeDoc,
  Member,
  Plan,
  PlanApprovalEvent,
  PlanApprovalResponse,
  PlanApprovalStatus,
  PlanCaptacao,
  ClientLink,
  PlanEvent,
  PlanItemApproval,
  PlanKind,
  PlanStatus,
  Project,
  StatusColor,
  StatusGroup,
  StatusHistoryEntry,
  Tag,
  TagKind,
  Task,
  TaskListKind,
  TaskStatus,
  UserRole,
} from "./types";

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

type ProjectRow = { id: string; name: string; client: string | null; client_role: string | null; client_city: string | null; client_instagram: string | null; status: Project["status"]; created_at: string; updated_at: string };

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client ?? undefined,
    clientRole: row.client_role ?? undefined,
    clientCity: row.client_city ?? undefined,
    clientInstagram: row.client_instagram ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export async function updateProject(id: string, patch: Partial<Pick<Project, "name" | "client" | "clientRole" | "clientCity" | "clientInstagram" | "status">>): Promise<Project | undefined> {
  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.client !== undefined) update.client = patch.client.trim() || null;
  if (patch.clientRole !== undefined) update.client_role = patch.clientRole.trim() || null;
  if (patch.clientCity !== undefined) update.client_city = patch.clientCity.trim() || null;
  if (patch.clientInstagram !== undefined) update.client_instagram = patch.clientInstagram.trim().replace(/^@/, "") || null;
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

// ---------- Acesso por lista de tarefas (Interna / Externa) ----------
// Mesmo padrão de listProjectAccess/setProjectAccess acima, só que pra lista.

export async function listMemberListAccess(memberId: string): Promise<TaskListKind[]> {
  const rows = unwrap(await getSupabase().from("member_list_access").select("list_kind").eq("member_id", memberId)) as { list_kind: TaskListKind }[];
  return rows.map((r) => r.list_kind);
}

export async function listAllMemberListAccess(): Promise<Record<string, TaskListKind[]>> {
  const rows = unwrap(await getSupabase().from("member_list_access").select("member_id, list_kind")) as { member_id: string; list_kind: TaskListKind }[];
  const map: Record<string, TaskListKind[]> = {};
  for (const row of rows) {
    (map[row.member_id] ??= []).push(row.list_kind);
  }
  return map;
}

export async function setMemberListAccess(memberId: string, listKinds: TaskListKind[]): Promise<void> {
  const db = getSupabase();
  unwrap(await db.from("member_list_access").delete().eq("member_id", memberId));
  const uniqueKinds = Array.from(new Set(listKinds));
  if (uniqueKinds.length) {
    unwrap(await db.from("member_list_access").insert(uniqueKinds.map((listKind) => ({ member_id: memberId, list_kind: listKind }))));
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
  images?: string[];
  driveLink?: string;
  formatTagIds?: string[];
  channelTagIds?: string[];
  categoryTagIds?: string[];
  status?: TaskStatus;
  planId?: string;
  captacaoId?: string;
  sequenceOrder?: number;
};

type TaskRow = {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  assignee_id: string | null;
  description: string | null;
  images: string[];
  drive_link: string | null;
  format_tag_ids: string[];
  channel_tag_ids: string[];
  category_tag_ids: string[];
  lists: TaskListKind[];
  status: TaskStatus;
  status_history: StatusHistoryEntry[];
  comments: Task["comments"];
  plan_id: string | null;
  captacao_id: string | null;
  sequence_order: number | null;
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
    images: row.images ?? [],
    driveLink: row.drive_link ?? undefined,
    formatTagIds: row.format_tag_ids ?? [],
    channelTagIds: row.channel_tag_ids ?? [],
    categoryTagIds: row.category_tag_ids ?? [],
    lists: row.lists ?? [],
    status: row.status,
    statusHistory: row.status_history ?? [],
    comments: row.comments ?? [],
    planId: row.plan_id ?? undefined,
    captacaoId: row.captacao_id ?? undefined,
    sequenceOrder: row.sequence_order ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------- Automação estratégica ⇄ criativa ----------
// 100% derivada do status — não existe mais um valor manual independente.
// Ao entrar em qualquer status dos grupos em_andamento/feita (a partir de
// pronto_para_criacao) pela primeira vez, a tarefa vira "criativa"; ao
// voltar pra qualquer status do grupo nao_iniciada, volta a "estrategica".
const STATUS_GROUP_BY_VALUE: Record<TaskStatus, StatusGroup> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.value, s.group]),
) as Record<TaskStatus, StatusGroup>;

function deriveListsForStatus(status: TaskStatus): TaskListKind[] {
  return STATUS_GROUP_BY_VALUE[status] === "nao_iniciada" ? ["estrategica"] : ["criativa"];
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
        images: dedupeIds(input.images ?? []),
        drive_link: input.driveLink?.trim() || null,
        format_tag_ids: dedupeIds(input.formatTagIds ?? []),
        channel_tag_ids: dedupeIds(input.channelTagIds ?? []),
        category_tag_ids: dedupeIds(input.categoryTagIds ?? []),
        // lists é sempre derivado do status inicial — um valor manual em
        // input.lists seria sobrescrito na primeira troca de status mesmo,
        // então nem aceitamos ele aqui (ver deriveListsForStatus acima).
        lists: deriveListsForStatus(status),
        status,
        status_history: openStatusHistory(status, now),
        comments: [],
        plan_id: input.planId || null,
        captacao_id: input.captacaoId || null,
        sequence_order: input.sequenceOrder ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single(),
  );
  return mapTask(row as TaskRow);
}

// Cria uma cópia independente da tarefa — mesmos dados, mas id, comentários e
// histórico de status novos (a cópia começa a contar tempo do zero no status
// atual, e não herda os comentários do original).
export async function duplicateTask(id: string): Promise<Task | undefined> {
  const current = await getTask(id);
  if (!current) return undefined;
  return createTask({
    projectId: current.projectId,
    name: `${current.name} (cópia)`,
    dueDate: current.dueDate,
    assigneeId: current.assigneeId,
    description: current.description,
    images: current.images,
    driveLink: current.driveLink,
    formatTagIds: current.formatTagIds,
    channelTagIds: current.channelTagIds,
    categoryTagIds: current.categoryTagIds,
    status: current.status,
    planId: current.planId,
    captacaoId: current.captacaoId,
    sequenceOrder: current.sequenceOrder,
  });
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
  if (patch.images !== undefined) update.images = dedupeIds(patch.images);
  if (patch.driveLink !== undefined) update.drive_link = patch.driveLink.trim() || null;
  if (patch.formatTagIds !== undefined) update.format_tag_ids = dedupeIds(patch.formatTagIds);
  if (patch.channelTagIds !== undefined) update.channel_tag_ids = dedupeIds(patch.channelTagIds);
  if (patch.categoryTagIds !== undefined) update.category_tag_ids = dedupeIds(patch.categoryTagIds);
  if (patch.planId !== undefined) update.plan_id = patch.planId || null;
  if (patch.captacaoId !== undefined) update.captacao_id = patch.captacaoId || null;
  if (patch.sequenceOrder !== undefined) update.sequence_order = patch.sequenceOrder;

  if (patch.status !== undefined && patch.status !== current.status) {
    update.status = patch.status;
    update.status_history = transitionStatusHistory(current.statusHistory, patch.status, nowIso());
    // lists é sempre recalculado a partir do novo status — nunca aceito
    // manualmente (ver deriveListsForStatus).
    update.lists = deriveListsForStatus(patch.status);
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

// ---------- Planos ----------
// Um Plano é só o container (título/projeto/kind) — os itens em si são
// Tasks com plan_id setado (ver createTask/updateTask acima). kind=content
// agrupa itens por PlanCaptacao; kind=process usa sequence_order; kind=
// presentation nunca tem Tasks (fica só no blob do vizantu-planos).

type PlanRow = {
  id: string;
  project_id: string;
  title: string;
  kind: PlanKind;
  status: PlanStatus;
  approval_deadline: string | null;
  approval_period_days: number | null;
  legacy_slug: string | null;
  html_blob_key: string | null;
  source: "native" | "legacy_blob";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    approvalDeadline: row.approval_deadline ?? undefined,
    approvalPeriodDays: row.approval_period_days ?? undefined,
    legacySlug: row.legacy_slug ?? undefined,
    htmlBlobKey: row.html_blob_key ?? undefined,
    source: row.source,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPlans(projectId?: string): Promise<Plan[]> {
  let query = getSupabase().from("plans").select("*").order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const rows = unwrap(await query);
  return (rows as PlanRow[]).map(mapPlan);
}

export async function getPlan(id: string): Promise<Plan | undefined> {
  const row = unwrap(await getSupabase().from("plans").select("*").eq("id", id).maybeSingle());
  return row ? mapPlan(row as PlanRow) : undefined;
}

export async function createPlan(input: {
  projectId: string;
  title: string;
  kind: PlanKind;
  approvalDeadline?: string;
  approvalPeriodDays?: number;
  createdBy?: string;
}): Promise<Plan> {
  const now = nowIso();
  const row = unwrap(
    await getSupabase()
      .from("plans")
      .insert({
        id: newId(),
        project_id: input.projectId,
        title: input.title.trim(),
        kind: input.kind,
        status: "draft",
        approval_deadline: input.approvalDeadline || null,
        approval_period_days: input.approvalPeriodDays ?? null,
        source: "native",
        created_by: input.createdBy || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single(),
  );
  return mapPlan(row as PlanRow);
}

export async function updatePlan(
  id: string,
  patch: Partial<Pick<Plan, "title" | "status" | "approvalDeadline" | "approvalPeriodDays">>,
): Promise<Plan | undefined> {
  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.approvalDeadline !== undefined) update.approval_deadline = patch.approvalDeadline || null;
  if (patch.approvalPeriodDays !== undefined) update.approval_period_days = patch.approvalPeriodDays ?? null;
  const row = unwrap(await getSupabase().from("plans").update(update).eq("id", id).select().maybeSingle());
  return row ? mapPlan(row as PlanRow) : undefined;
}

export async function deletePlan(id: string): Promise<boolean> {
  // plan_id em tasks tem "on delete cascade" — apagar o plano já leva os
  // itens (tasks) dele junto.
  const rows = unwrap(await getSupabase().from("plans").delete().eq("id", id).select("id"));
  return (rows as unknown[]).length > 0;
}

// ---------- Captações (agrupamento livre dentro de um Plano de conteúdo) ----------

type PlanCaptacaoRow = { id: string; plan_id: string; label: string; sequence_order: number; created_at: string };

function mapPlanCaptacao(row: PlanCaptacaoRow): PlanCaptacao {
  return { id: row.id, planId: row.plan_id, label: row.label, sequenceOrder: row.sequence_order, createdAt: row.created_at };
}

export async function listPlanCaptacoes(planId: string): Promise<PlanCaptacao[]> {
  const rows = unwrap(await getSupabase().from("plan_captacoes").select("*").eq("plan_id", planId).order("sequence_order"));
  return (rows as PlanCaptacaoRow[]).map(mapPlanCaptacao);
}

export async function createPlanCaptacao(input: { planId: string; label: string; sequenceOrder?: number }): Promise<PlanCaptacao> {
  const row = unwrap(
    await getSupabase()
      .from("plan_captacoes")
      .insert({ id: newId(), plan_id: input.planId, label: input.label.trim(), sequence_order: input.sequenceOrder ?? 0, created_at: nowIso() })
      .select()
      .single(),
  );
  return mapPlanCaptacao(row as PlanCaptacaoRow);
}

export async function deletePlanCaptacao(id: string): Promise<boolean> {
  const rows = unwrap(await getSupabase().from("plan_captacoes").delete().eq("id", id).select("id"));
  return (rows as unknown[]).length > 0;
}

// Lista as tasks de um plano já agrupadas — usado tanto pela view interna do
// Plano quanto pelo dashboard do cliente no vizantu-planos.
export async function listPlanTasks(planId: string): Promise<Task[]> {
  const rows = unwrap(await getSupabase().from("tasks").select("*").eq("plan_id", planId)) as TaskRow[];
  return rows.map(mapTask).sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));
}

// ---------- Clientes e link mágico (consumidos pelo vizantu-planos) ----------

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// Link de acesso do cliente — pendura no PROJETO (o projeto já É a conta do
// cliente; não existe entidade "cliente" separada).
type ClientLinkRow = {
  id: string;
  project_id: string;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

function mapClientLink(row: ClientLinkRow): ClientLink {
  return {
    id: row.id,
    projectId: row.project_id,
    token: row.token,
    expiresAt: row.expires_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    lastUsedAt: row.last_used_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listClientLinks(projectId: string): Promise<ClientLink[]> {
  const rows = unwrap(await getSupabase().from("client_links").select("*").eq("project_id", projectId).order("created_at", { ascending: false }));
  return (rows as ClientLinkRow[]).map(mapClientLink);
}

export async function createClientLink(projectId: string, expiresAt?: string): Promise<ClientLink> {
  const row = unwrap(
    await getSupabase()
      .from("client_links")
      .insert({ id: newId(), project_id: projectId, token: randomToken(), expires_at: expiresAt || null, created_at: nowIso() })
      .select()
      .single(),
  );
  return mapClientLink(row as ClientLinkRow);
}

export async function revokeClientLink(id: string): Promise<void> {
  unwrap(await getSupabase().from("client_links").update({ revoked_at: nowIso() }).eq("id", id));
}

// Resolve o token pro PROJETO dono dele, validando revogação/expiração —
// usado pela rota pública /c/[token].
export async function resolveClientLink(token: string): Promise<Project | undefined> {
  const row = unwrap(await getSupabase().from("client_links").select("*").eq("token", token).maybeSingle()) as ClientLinkRow | null;
  if (!row) return undefined;
  if (row.revoked_at) return undefined;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return undefined;
  unwrap(await getSupabase().from("client_links").update({ last_used_at: nowIso() }).eq("id", row.id));
  return getProject(row.project_id);
}

// Itens de plano de um projeto, enriquecidos com formato/categoria/captação
// e o status de aprovação do CLIENTE — é o que alimenta o painel público
// em /c/[token]. Nunca usa o status interno de produção.
export type ProjectPlanItem = {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  captacaoLabel: string | null;
  formatLabel: string | null;
  categoryLabel: string | null;
  description: string | null;
  approvalStatus: PlanApprovalStatus;
  reviewVersion: number;
  updatedAt: string;
};

export async function listProjectPlanItems(projectId: string): Promise<ProjectPlanItem[]> {
  const db = getSupabase();
  const plans = unwrap(await db.from("plans").select("id, kind").eq("project_id", projectId).eq("source", "native")) as { id: string; kind: string }[];
  const planIds = plans.filter((p) => p.kind === "content" || p.kind === "process").map((p) => p.id);
  if (!planIds.length) return [];

  const rows = unwrap(
    await db
      .from("tasks")
      .select("id, captacao_id, name, status, due_date, format_tag_ids, category_tag_ids, description, updated_at")
      .in("plan_id", planIds),
  ) as {
    id: string;
    captacao_id: string | null;
    name: string;
    status: string;
    due_date: string | null;
    format_tag_ids: string[];
    category_tag_ids: string[];
    description: string | null;
    updated_at: string;
  }[];
  if (!rows.length) return [];

  const taskIds = rows.map((t) => t.id);
  const captacaoIds = Array.from(new Set(rows.map((t) => t.captacao_id).filter((v): v is string => Boolean(v))));
  const tagIds = Array.from(new Set(rows.flatMap((t) => [...t.format_tag_ids, ...t.category_tag_ids])));

  const [captacoes, tags, approvals] = await Promise.all([
    captacaoIds.length ? (unwrap(await db.from("plan_captacoes").select("id, label").in("id", captacaoIds)) as { id: string; label: string }[]) : Promise.resolve([]),
    tagIds.length ? (unwrap(await db.from("tags").select("id, label, kind").in("id", tagIds)) as { id: string; label: string; kind: string }[]) : Promise.resolve([]),
    unwrap(await db.from("plan_item_approvals").select("task_id, status, review_version").in("task_id", taskIds)) as {
      task_id: string;
      status: PlanApprovalStatus;
      review_version: number;
    }[],
  ]);

  const captacaoById = new Map(captacoes.map((c) => [c.id, c.label]));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const approvalByTask = new Map(approvals.map((a) => [a.task_id, a]));

  return rows.map((t) => {
    const formatId = t.format_tag_ids.find((id) => tagById.get(id)?.kind === "formato");
    const approval = approvalByTask.get(t.id);
    return {
      id: t.id,
      name: t.name,
      status: t.status,
      dueDate: t.due_date,
      captacaoLabel: t.captacao_id ? captacaoById.get(t.captacao_id) || null : null,
      formatLabel: formatId ? tagById.get(formatId)?.label || null : null,
      categoryLabel: t.category_tag_ids[0] ? tagById.get(t.category_tag_ids[0])?.label || null : null,
      description: t.description,
      approvalStatus: approval?.status || "pending",
      reviewVersion: approval?.review_version || 1,
      updatedAt: t.updated_at,
    };
  });
}

// ---------- Aprovação do cliente (eixo separado de tasks.status) ----------

type PlanItemApprovalRow = { task_id: string; status: PlanApprovalStatus; review_version: number; updated_at: string };

function mapPlanItemApproval(row: PlanItemApprovalRow): PlanItemApproval {
  return { taskId: row.task_id, status: row.status, reviewVersion: row.review_version, updatedAt: row.updated_at };
}

export async function listPlanItemApprovals(taskIds: string[]): Promise<PlanItemApproval[]> {
  if (!taskIds.length) return [];
  const rows = unwrap(await getSupabase().from("plan_item_approvals").select("*").in("task_id", taskIds));
  return (rows as PlanItemApprovalRow[]).map(mapPlanItemApproval);
}

// Recalcula o status agregado do item a partir das respostas de todos os
// revisores daquela versão — pior status vence: rejected > changes_requested
// > approved (mesma regra que o vizantu-planos já usava em cima do blob).
function aggregateResponses(responses: { status: PlanApprovalResponse["status"] }[]): PlanApprovalStatus {
  if (responses.some((r) => r.status === "rejected")) return "rejected";
  if (responses.some((r) => r.status === "changes_requested")) return "changes_requested";
  if (responses.some((r) => r.status === "approved")) return "approved";
  return "pending";
}

type PlanApprovalResponseRow = {
  id: string;
  task_id: string;
  reviewer_name: string;
  status: PlanApprovalResponse["status"];
  comment: string | null;
  review_version: number;
  created_at: string;
};

function mapPlanApprovalResponse(row: PlanApprovalResponseRow): PlanApprovalResponse {
  return {
    id: row.id,
    taskId: row.task_id,
    reviewerName: row.reviewer_name,
    status: row.status,
    comment: row.comment ?? undefined,
    reviewVersion: row.review_version,
    createdAt: row.created_at,
  };
}

export async function listPlanApprovalResponses(taskId: string): Promise<PlanApprovalResponse[]> {
  const rows = unwrap(await getSupabase().from("plan_approval_responses").select("*").eq("task_id", taskId).order("created_at"));
  return (rows as PlanApprovalResponseRow[]).map(mapPlanApprovalResponse);
}

export async function submitPlanApprovalResponse(input: {
  taskId: string;
  clientId?: string;
  reviewerName: string;
  status: PlanApprovalResponse["status"];
  comment?: string;
}): Promise<PlanItemApproval> {
  const db = getSupabase();
  const existingRow = unwrap(await db.from("plan_item_approvals").select("*").eq("task_id", input.taskId).maybeSingle()) as PlanItemApprovalRow | null;
  const reviewVersion = existingRow?.review_version ?? 1;
  const previousStatus = existingRow?.status ?? "pending";

  // Upsert da resposta deste revisor (por reviewer_name + task_id + versão) —
  // reenviar substitui a resposta anterior da mesma pessoa na mesma versão.
  const priorResponses = unwrap(
    await db.from("plan_approval_responses").select("*").eq("task_id", input.taskId).eq("review_version", reviewVersion),
  ) as PlanApprovalResponseRow[];
  const ownPrior = priorResponses.find((r) => r.reviewer_name === input.reviewerName);
  if (ownPrior) {
    unwrap(
      await db
        .from("plan_approval_responses")
        .update({ status: input.status, comment: input.comment?.trim() || null })
        .eq("id", ownPrior.id),
    );
  } else {
    unwrap(
      await db.from("plan_approval_responses").insert({
        id: newId(),
        task_id: input.taskId,
        reviewer_name: input.reviewerName,
        status: input.status,
        comment: input.comment?.trim() || null,
        review_version: reviewVersion,
        created_at: nowIso(),
      }),
    );
  }

  const allResponses = unwrap(
    await db.from("plan_approval_responses").select("status").eq("task_id", input.taskId).eq("review_version", reviewVersion),
  ) as { status: PlanApprovalResponse["status"] }[];
  const aggregated = aggregateResponses(allResponses);

  unwrap(
    await db
      .from("plan_item_approvals")
      .upsert({ task_id: input.taskId, status: aggregated, review_version: reviewVersion, updated_at: nowIso() }),
  );

  unwrap(
    await db.from("plan_approval_events").insert({
      id: newId(),
      task_id: input.taskId,
      action: input.status,
      status: aggregated,
      previous_status: previousStatus,
      comment: input.comment?.trim() || null,
      reviewer_name: input.reviewerName,
      review_version: reviewVersion,
      created_at: nowIso(),
    }),
  );

  return { taskId: input.taskId, status: aggregated, reviewVersion, updatedAt: nowIso() };
}

type PlanApprovalEventRow = {
  id: string;
  task_id: string;
  action: PlanApprovalEvent["action"];
  status: string;
  previous_status: string;
  comment: string | null;
  reviewer_name: string | null;
  review_version: number | null;
  created_at: string;
};

function mapPlanApprovalEvent(row: PlanApprovalEventRow): PlanApprovalEvent {
  return {
    id: row.id,
    taskId: row.task_id,
    action: row.action,
    status: row.status,
    previousStatus: row.previous_status,
    comment: row.comment ?? undefined,
    reviewerName: row.reviewer_name ?? undefined,
    reviewVersion: row.review_version ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listPlanApprovalEvents(taskId: string): Promise<PlanApprovalEvent[]> {
  const rows = unwrap(await getSupabase().from("plan_approval_events").select("*").eq("task_id", taskId).order("created_at"));
  return (rows as PlanApprovalEventRow[]).map(mapPlanApprovalEvent);
}

// ---------- Dashboard do cliente ----------

type ClientSatisfactionScoreRow = { id: string; project_id: string; score: number; created_at: string };

function mapSatisfactionScore(row: ClientSatisfactionScoreRow): ClientSatisfactionScore {
  return { id: row.id, projectId: row.project_id, score: row.score, createdAt: row.created_at };
}

export async function listSatisfactionScores(projectId: string): Promise<ClientSatisfactionScore[]> {
  const rows = unwrap(
    await getSupabase().from("client_satisfaction_scores").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
  );
  return (rows as ClientSatisfactionScoreRow[]).map(mapSatisfactionScore);
}

export async function addSatisfactionScore(input: { projectId: string; score: number }): Promise<ClientSatisfactionScore> {
  const row = unwrap(
    await getSupabase()
      .from("client_satisfaction_scores")
      .insert({ id: newId(), project_id: input.projectId, score: input.score, created_at: nowIso() })
      .select()
      .single(),
  );
  return mapSatisfactionScore(row as ClientSatisfactionScoreRow);
}

type PlanEventRow = {
  id: string;
  project_id: string;
  title: string;
  event_type: string;
  event_date: string;
  created_by: string | null;
  created_at: string;
};

function mapPlanEvent(row: PlanEventRow): PlanEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    eventType: row.event_type,
    eventDate: row.event_date,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listPlanEvents(projectId: string): Promise<PlanEvent[]> {
  const rows = unwrap(await getSupabase().from("plan_events").select("*").eq("project_id", projectId).order("event_date"));
  return (rows as PlanEventRow[]).map(mapPlanEvent);
}

export async function createPlanEvent(input: { projectId: string; title: string; eventType?: string; eventDate: string; createdBy?: string }): Promise<PlanEvent> {
  const row = unwrap(
    await getSupabase()
      .from("plan_events")
      .insert({
        id: newId(),
        project_id: input.projectId,
        title: input.title.trim(),
        event_type: input.eventType || "reuniao",
        event_date: input.eventDate,
        created_by: input.createdBy || null,
        created_at: nowIso(),
      })
      .select()
      .single(),
  );
  return mapPlanEvent(row as PlanEventRow);
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

// ---------- Cores por etapa do status ----------
// A tabela só guarda o que foi customizado — o resto sai de DEFAULT_STATUS_COLORS,
// então a lista devolvida aqui SEMPRE tem as 12 etapas, customizadas ou não.

type StatusColorRow = { status: TaskStatus; color: string };

export async function listStatusColors(): Promise<StatusColor[]> {
  const rows = unwrap(await getSupabase().from("status_colors").select("status, color")) as StatusColorRow[];
  const overrides = new Map(rows.map((row) => [row.status, row.color]));
  return TASK_STATUSES.map((status) => ({ status: status.value, color: overrides.get(status.value) || DEFAULT_STATUS_COLORS[status.value] }));
}

export async function setStatusColors(colors: Partial<Record<TaskStatus, string>>): Promise<StatusColor[]> {
  const entries = Object.entries(colors) as [TaskStatus, string][];
  if (entries.length) {
    unwrap(
      await getSupabase()
        .from("status_colors")
        .upsert(entries.map(([status, color]) => ({ status, color, updated_at: nowIso() }))),
    );
  }
  return listStatusColors();
}

// ---------- Aviso (broadcast com confirmação obrigatória) ----------
// Nunca some da tela do destinatário por timeout ou fechar sem clicar — só
// quando ele confirma explicitamente (ver acknowledgeAnnouncement). Ver
// AdminShell (o único componente presente em toda página autenticada) pra
// onde isso é renderizado como modal bloqueante.

type AnnouncementRow = {
  id: string;
  title: string | null;
  body: string;
  created_by: string | null;
  scope: AnnouncementScope;
  scope_role: UserRole | null;
  scope_member_id: string | null;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

function mapAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title ?? undefined,
    body: row.body,
    createdBy: row.created_by ?? undefined,
    scope: row.scope,
    scopeRole: row.scope_role ?? undefined,
    scopeMemberId: row.scope_member_id ?? undefined,
    active: row.active,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const rows = unwrap(await getSupabase().from("announcements").select("*").order("created_at", { ascending: false }));
  return (rows as AnnouncementRow[]).map(mapAnnouncement);
}

export async function createAnnouncement(input: {
  title?: string;
  body: string;
  createdBy?: string;
  scope: AnnouncementScope;
  scopeRole?: UserRole;
  scopeMemberId?: string;
  expiresAt?: string;
}): Promise<Announcement> {
  const row = unwrap(
    await getSupabase()
      .from("announcements")
      .insert({
        id: newId(),
        title: input.title?.trim() || null,
        body: input.body.trim(),
        created_by: input.createdBy || null,
        scope: input.scope,
        scope_role: input.scope === "role" ? input.scopeRole : null,
        scope_member_id: input.scope === "member" ? input.scopeMemberId : null,
        active: true,
        expires_at: input.expiresAt || null,
        created_at: nowIso(),
      })
      .select()
      .single(),
  );
  return mapAnnouncement(row as AnnouncementRow);
}

export async function deactivateAnnouncement(id: string): Promise<void> {
  unwrap(await getSupabase().from("announcements").update({ active: false }).eq("id", id));
}

// Só os avisos ainda pendentes de confirmação PARA ESTE usuário específico —
// escopo (all/role/member) e ack já filtrados, é isso que o AdminShell busca
// no mount pra decidir se mostra o modal bloqueante.
export async function listPendingAnnouncementsForMember(member: { id: string; role: UserRole }): Promise<Announcement[]> {
  const db = getSupabase();
  const now = nowIso();
  const activeRows = unwrap(await db.from("announcements").select("*").eq("active", true)) as AnnouncementRow[];
  const notExpired = activeRows.filter((row) => !row.expires_at || row.expires_at > now);
  const inScope = notExpired.filter(
    (row) => row.scope === "all" || (row.scope === "role" && row.scope_role === member.role) || (row.scope === "member" && row.scope_member_id === member.id),
  );
  if (!inScope.length) return [];

  const ackRows = unwrap(
    await db
      .from("announcement_acknowledgements")
      .select("announcement_id")
      .eq("member_id", member.id)
      .in("announcement_id", inScope.map((row) => row.id)),
  ) as { announcement_id: string }[];
  const ackedIds = new Set(ackRows.map((r) => r.announcement_id));

  return inScope.filter((row) => !ackedIds.has(row.id)).map(mapAnnouncement).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function acknowledgeAnnouncement(announcementId: string, memberId: string): Promise<void> {
  unwrap(
    await getSupabase()
      .from("announcement_acknowledgements")
      .upsert({ announcement_id: announcementId, member_id: memberId, acknowledged_at: nowIso() }),
  );
}
