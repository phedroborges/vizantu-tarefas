export type ProjectStatus = "ativo" | "pausado" | "concluido";

export type Project = {
  id: string;
  name: string;
  client?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
];

// ---------- Membros ----------

export type Member = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// ---------- Etiquetas (Formato / Canal) ----------

export type TagKind = "formato" | "canal";

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
  { value: "aprovacao_copy", label: "Aprovação de copy", group: "nao_iniciada" },
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

// ---------- Tarefa ----------

export type Task = {
  id: string;
  projectId: string;
  name: string;
  dueDate?: string;
  assigneeId?: string;
  description?: string;
  driveLink?: string;
  formatTagIds: string[];
  channelTagIds: string[];
  status: TaskStatus;
  statusHistory: StatusHistoryEntry[];
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
};

// ---------- Colunas configuráveis da lista de tarefas ----------

export type TaskColumnKey = "formatTags" | "channelTags" | "assignee" | "dueDate" | "status" | "driveLink";

export const TASK_COLUMNS: { key: TaskColumnKey; label: string; defaultVisible: boolean }[] = [
  { key: "formatTags", label: "Formato", defaultVisible: true },
  { key: "channelTags", label: "Canal", defaultVisible: true },
  { key: "assignee", label: "Responsável", defaultVisible: true },
  { key: "dueDate", label: "Prazo", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "driveLink", label: "Link (Drive)", defaultVisible: false },
];
