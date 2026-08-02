export type ProjectStatus = "ativo" | "pausado" | "concluido";

export type Project = {
  id: string;
  name: string;
  client?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type TaskFormat = "video" | "imagem" | "post" | "estatico" | "carrossel";

export type TaskStatus = "a_fazer" | "em_andamento" | "concluida";

export type Comment = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

export type Task = {
  id: string;
  projectId: string;
  name: string;
  dueDate?: string;
  assignee?: string;
  description?: string;
  driveLink?: string;
  format?: TaskFormat;
  channel?: string;
  status: TaskStatus;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
};

export const TASK_FORMATS: { value: TaskFormat; label: string }[] = [
  { value: "video", label: "Vídeo" },
  { value: "imagem", label: "Imagem" },
  { value: "post", label: "Post" },
  { value: "estatico", label: "Estático" },
  { value: "carrossel", label: "Carrossel" },
];

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "a_fazer", label: "A fazer" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
];

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
];

export const CHANNEL_SUGGESTIONS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Facebook",
  "LinkedIn",
  "WhatsApp",
  "Site",
];
