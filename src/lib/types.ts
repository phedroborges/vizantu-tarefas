export type ProjectStatus = "ativo" | "pausado" | "concluido";

// O projeto É a conta do cliente — os dados de exibição do cliente moram
// aqui, não numa entidade paralela. Aparecem no cabeçalho do painel que o
// cliente acessa pelo link mágico.
export type Project = {
  id: string;
  name: string;
  client?: string;
  clientRole?: string;
  clientCity?: string;
  clientInstagram?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
];

// ---------- Membros (= usuários com login) ----------

export type UserRole = "dono" | "editor" | "visualizador";

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "dono", label: "Dono" },
  { value: "editor", label: "Editor" },
  { value: "visualizador", label: "Visualizador" },
];

export type Member = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  aiEnabled: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// ---------- Etiquetas (Formato / Canal / Categoria) ----------

export type TagKind = "formato" | "canal" | "categoria";

export type Tag = {
  id: string;
  kind: TagKind;
  label: string;
  createdAt: string;
};

// ---------- Pipeline de status (12 valores, 3 grupos) ----------

export type TaskStatus =
  | "rascunho"
  | "aguardando_informacao"
  | "aprovacao_copy"
  | "aguardando_captacao"
  | "pronto_para_criacao"
  | "em_criacao"
  | "revisao"
  | "ajuste"
  | "para_aprovacao"
  | "aprovado"
  | "problema"
  | "finalizado";

export type StatusGroup = "nao_iniciada" | "em_andamento" | "feita";

export const STATUS_GROUPS: { value: StatusGroup; label: string }[] = [
  { value: "nao_iniciada", label: "Não iniciada" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "feita", label: "Feita" },
];

// Lista plana e ORDENADA — alimenta o select agrupado, os botões de avançar/voltar
// (passo ±1 nesta lista) e a ordem das linhas no painel de tempo por status.
export const TASK_STATUSES: { value: TaskStatus; label: string; group: StatusGroup }[] = [
  { value: "rascunho", label: "Rascunho", group: "nao_iniciada" },
  { value: "aguardando_informacao", label: "Aguardando informação", group: "nao_iniciada" },
  { value: "aprovacao_copy", label: "Aprovação de texto", group: "nao_iniciada" },
  { value: "aguardando_captacao", label: "Aguardando captação", group: "nao_iniciada" },
  { value: "pronto_para_criacao", label: "Pronto para criação", group: "em_andamento" },
  { value: "em_criacao", label: "Em criação", group: "em_andamento" },
  { value: "revisao", label: "Revisão", group: "em_andamento" },
  { value: "ajuste", label: "Ajuste", group: "em_andamento" },
  { value: "para_aprovacao", label: "Para aprovação", group: "feita" },
  { value: "aprovado", label: "Aprovado", group: "feita" },
  { value: "problema", label: "Problema", group: "feita" },
  { value: "finalizado", label: "Finalizado", group: "feita" },
];

// Confirmado com o Phedro: nestes 3 status a demanda já foi produzida (o que
// resta são fatores externos) — por isso nunca contam como atrasada, e a data
// de entrega volta a ficar editável.
export const DONE_STATUSES: TaskStatus[] = ["aprovado", "problema", "finalizado"];

// ---------- Cor por etapa do status (customizável, ver status_colors) ----------
// Default = mesma cor que o grupo já usava, então enquanto ninguém customiza
// nada a UI continua idêntica ao que era antes desta função existir.
const GROUP_DEFAULT_COLOR: Record<StatusGroup, string> = {
  nao_iniciada: "#aeb5ae",
  em_andamento: "#e3c23c",
  feita: "#6aa329",
};

export const DEFAULT_STATUS_COLORS: Record<TaskStatus, string> = Object.fromEntries(
  TASK_STATUSES.map((status) => [status.value, GROUP_DEFAULT_COLOR[status.group]]),
) as Record<TaskStatus, string>;

export type StatusColor = { status: TaskStatus; color: string };

// ---------- Histórico de status (tempo em cada etapa) ----------

export type StatusHistoryEntry = {
  status: TaskStatus;
  enteredAt: string;
  exitedAt: string | null; // null = entrada aberta/atual
};

// ---------- Comentários ----------

export type Comment = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

// ---------- Listas de tarefas (Estratégica / Criativa) ----------
// Deriva 100% do status via deriveListsForStatus (storage.ts) — não existe
// mais toggle manual. Só entra em "criativa" ao alcançar pronto_para_criacao
// (ou além); volta pra "estrategica" se o status recuar pro grupo
// nao_iniciada. member_list_access continua controlando o acesso do
// visualizador por lista, só com os novos nomes.

export type TaskListKind = "estrategica" | "criativa";

export const TASK_LIST_KINDS: { value: TaskListKind; label: string }[] = [
  { value: "estrategica", label: "Estratégica" },
  { value: "criativa", label: "Criativa" },
];

// ---------- Tarefa ----------
// planId/captacaoId/etc só são preenchidos quando a tarefa é um item de um
// Plano (ver Plan mais abaixo) — em qualquer outro caso ficam undefined e a
// tarefa se comporta exatamente como antes.

export type Task = {
  id: string;
  projectId: string;
  name: string;
  dueDate?: string;
  assigneeId?: string;
  description?: string;
  images: string[];
  driveLink?: string;
  formatTagIds: string[];
  channelTagIds: string[];
  categoryTagIds: string[];
  lists: TaskListKind[];
  status: TaskStatus;
  statusHistory: StatusHistoryEntry[];
  comments: Comment[];
  planId?: string;
  captacaoId?: string;
  sequenceOrder?: number;
  createdAt: string;
  updatedAt: string;
};

// ---------- Planos ----------
// Um Plano é um container: title/projeto + kind. "content" = conjunto de
// conteúdos (vídeos/posts/carrosséis), cada um vira uma Task com plan_id
// setado e os campos de conteúdo preenchidos, agrupados em PlanCaptacao.
// "process" = lista ordenada de passos (ex: onboarding de ads), também
// Tasks com plan_id, sem os campos de conteúdo. "presentation" nunca gera
// Tasks — continua servido pelo pipeline de blob do vizantu-planos.

export type PlanKind = "content" | "process" | "presentation";
export type PlanStatus = "draft" | "active" | "completed" | "archived";

export const PLAN_KINDS: { value: PlanKind; label: string }[] = [
  { value: "content", label: "Conteúdo (vídeos, posts, carrosséis)" },
  { value: "process", label: "Processo (passos ordenados)" },
  { value: "presentation", label: "Apresentação (HTML livre)" },
];

export type Plan = {
  id: string;
  projectId: string;
  title: string;
  kind: PlanKind;
  status: PlanStatus;
  approvalDeadline?: string;
  approvalPeriodDays?: number;
  legacySlug?: string;
  htmlBlobKey?: string;
  source: "native" | "legacy_blob";
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlanCaptacao = {
  id: string;
  planId: string;
  label: string;
  sequenceOrder: number;
  createdAt: string;
};

// ---------- Clientes e link mágico (vizantu-planos) ----------

// Link de acesso do cliente ao painel — um por projeto, sem senha.
export type ClientLink = {
  id: string;
  projectId: string;
  token: string;
  expiresAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
};

// ---------- Aprovação do cliente (eixo separado do status interno) ----------

export type PlanApprovalStatus = "pending" | "approved" | "changes_requested" | "rejected";

export type PlanItemApproval = {
  taskId: string;
  status: PlanApprovalStatus;
  reviewVersion: number;
  updatedAt: string;
};

export type PlanApprovalResponse = {
  id: string;
  taskId: string;
  reviewerName: string;
  status: "approved" | "changes_requested" | "rejected";
  comment?: string;
  reviewVersion: number;
  createdAt: string;
};

export type PlanApprovalEvent = {
  id: string;
  taskId: string;
  action: "approved" | "changes_requested" | "rejected" | "commented" | "reopened";
  status: string;
  previousStatus: string;
  comment?: string;
  reviewerName?: string;
  reviewVersion?: number;
  createdAt: string;
};

// ---------- Dashboard do cliente ----------

export type ClientSatisfactionScore = {
  id: string;
  projectId: string;
  score: number;
  createdAt: string;
};

export type PlanEvent = {
  id: string;
  projectId: string;
  title: string;
  eventType: string;
  eventDate: string;
  createdBy?: string;
  createdAt: string;
};

// ---------- Aviso (broadcast com confirmação obrigatória) ----------
// scope="all" avisa todo mundo; "role" avisa uma categoria (dono/editor/
// visualizador); "member" avisa uma pessoa específica. Some da tela do
// destinatário só depois do ack explícito (announcement_acknowledgements) —
// nunca por timeout, nunca por fechar sem clicar.

export type AnnouncementScope = "all" | "role" | "member";

export const ANNOUNCEMENT_SCOPES: { value: AnnouncementScope; label: string }[] = [
  { value: "all", label: "Todos os usuários" },
  { value: "role", label: "Uma categoria (papel)" },
  { value: "member", label: "Um usuário específico" },
];

export type Announcement = {
  id: string;
  title?: string;
  body: string;
  createdBy?: string;
  scope: AnnouncementScope;
  scopeRole?: UserRole;
  scopeMemberId?: string;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
};

// ---------- Base de conhecimento (playbooks consultados pela IA) ----------

export type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

// ---------- Conversas do assistente (chat em tela cheia) ----------

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: string[];
  pendingConfirmation?: { taskId: string; taskName: string } | null;
};

export type AssistantConversation = {
  id: string;
  title: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
};

// ---------- Colunas configuráveis da lista de tarefas ----------

export type TaskColumnKey = "formatTags" | "channelTags" | "assignee" | "dueDate" | "status" | "driveLink" | "lists";

export const TASK_COLUMNS: { key: TaskColumnKey; label: string; defaultVisible: boolean }[] = [
  { key: "formatTags", label: "Formato", defaultVisible: true },
  { key: "channelTags", label: "Canal", defaultVisible: true },
  { key: "assignee", label: "Responsável", defaultVisible: true },
  { key: "dueDate", label: "Prazo", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "lists", label: "Lista", defaultVisible: false },
  { key: "driveLink", label: "Link (Drive)", defaultVisible: false },
];
