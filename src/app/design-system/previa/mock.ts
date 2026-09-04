// Dados de mentira para a prévia das telas reais.
//
// Existe porque as telas do app vivem atrás do login e de um Supabase com
// dados de cliente — e sem conseguir OLHAR pra elas não dá pra migrar o visual
// com honestidade. As views são todas dirigidas por props, então basta montar
// as props aqui e a tela renderiza igualzinho à de produção.

import type {
  Member, Plan, PlanCaptacao, PlanItemApproval, Project, StatusColor, Tag, Task,
} from "@/lib/types";
import { DEFAULT_STATUS_COLORS, TASK_STATUSES } from "@/lib/types";

const AGORA = "2026-09-04T12:00:00.000Z";

export const PROJETO: Project = {
  id: "proj-1", name: "TerraNet", client: "TerraNet Telecom", clientRole: "Provedor de internet",
  clientCity: "Portelândia", clientInstagram: "@terranet", avatarUrl: null, avatarColor: "#3B82D9",
  status: "ativo", createdAt: AGORA, updatedAt: AGORA,
};

export const PROJETOS: Project[] = [
  PROJETO,
  { id: "proj-2", name: "Casa Nova Móveis", client: "Casa Nova", status: "ativo", createdAt: AGORA, updatedAt: AGORA },
  { id: "proj-3", name: "Clínica Vitta", client: "Vitta", status: "pausado", createdAt: AGORA, updatedAt: AGORA },
];

export const MEMBROS: Member[] = [
  { id: "m1", name: "Cynthia Almeida", email: "cynthia@vizantu.com.br", role: "editor", aiEnabled: true, active: true, avatarUrl: "/demo/avatares/cynthia.svg", createdAt: AGORA, updatedAt: AGORA },
  { id: "m2", name: "Erika Iorrana", email: "erika@vizantu.com.br", role: "editor", aiEnabled: true, active: true, avatarUrl: "/demo/avatares/erika.svg", createdAt: AGORA, updatedAt: AGORA },
  { id: "m3", name: "Luis Fontes", email: "luis@vizantu.com.br", role: "editor", aiEnabled: false, active: true, avatarUrl: "/demo/avatares/luis.svg", createdAt: AGORA, updatedAt: AGORA },
  { id: "m4", name: "Phedro Borges", email: "phedro@vizantu.com.br", role: "dono", aiEnabled: true, active: true, avatarUrl: "/demo/avatares/phedro.svg", createdAt: AGORA, updatedAt: AGORA },
];

export const FORMATOS: Tag[] = [
  { id: "f1", kind: "formato", label: "Reels", createdAt: AGORA },
  { id: "f2", kind: "formato", label: "Carrossel", createdAt: AGORA },
  { id: "f3", kind: "formato", label: "Estático", createdAt: AGORA },
];
export const CANAIS: Tag[] = [
  { id: "c1", kind: "canal", label: "Instagram", createdAt: AGORA },
  { id: "c2", kind: "canal", label: "TikTok", createdAt: AGORA },
];
export const CATEGORIAS: Tag[] = [
  { id: "k1", kind: "categoria", label: "Educativo", createdAt: AGORA },
  { id: "k2", kind: "categoria", label: "Autoridade", createdAt: AGORA },
];

export const CORES_STATUS: StatusColor[] = TASK_STATUSES.map((s) => ({ status: s.value, color: DEFAULT_STATUS_COLORS[s.value] }));

type Semente = {
  nome: string; status: Task["status"]; dono: string; prazo: string;
  formato: string; captacao?: string; atrasada?: boolean;
};

const SEMENTES: Semente[] = [
  { nome: "Para quem leva o game a sério", status: "aprovacao_copy", dono: "m1", prazo: "2026-09-09", formato: "f2", captacao: "cap-3" },
  { nome: "Internet segura para crianças e idosos", status: "em_criacao", dono: "m1", prazo: "2026-09-11", formato: "f2", captacao: "cap-3" },
  { nome: "O problema pode não ser a sua internet, pode ser o seu Wi-Fi", status: "revisao", dono: "m2", prazo: "2026-09-14", formato: "f2", captacao: "cap-3" },
  { nome: "Casa Conectada na Primavera", status: "para_aprovacao", dono: "m1", prazo: "2026-09-22", formato: "f3", captacao: "cap-4" },
  { nome: "7 de Setembro: Independência do Brasil", status: "aprovado", dono: "m3", prazo: "2026-09-07", formato: "f3", captacao: "cap-4" },
  { nome: "Aproveitando seu colega de serviço", status: "aguardando_captacao", dono: "m1", prazo: "2026-09-17", formato: "f1", captacao: "cap-1" },
  { nome: "A velocidade que realmente importa", status: "problema", dono: "m2", prazo: "2026-08-25", formato: "f1", captacao: "cap-2", atrasada: true },
  { nome: "Tentando explicar o que a TerraNet faz", status: "pronto_para_criacao", dono: "m3", prazo: "2026-09-24", formato: "f1", captacao: "cap-1" },
  { nome: "Quando a internet instável interfere na rotina", status: "ajuste", dono: "m2", prazo: "2026-09-28", formato: "f1", captacao: "cap-2" },
  { nome: "Instalação de Antena no Prédio Savana", status: "rascunho", dono: "m2", prazo: "2026-09-08", formato: "f1", captacao: "cap-1" },
];

function tarefa(semente: Semente, indice: number, comPlano: boolean): Task {
  return {
    id: `t${indice + 1}`,
    projectId: "proj-1",
    name: semente.nome,
    kind: "conteudo",
    dueDate: semente.prazo,
    assigneeId: semente.dono,
    description: "## Roteiro\n\nCena 1 — abertura falando com a câmera.\n\n## Legenda\n\nSua internet pode estar ótima; o problema costuma ser o Wi-Fi.",
    images: [],
    driveLink: indice % 2 === 0 ? "https://drive.google.com/exemplo" : undefined,
    formatTagIds: [semente.formato],
    channelTagIds: [indice === 6 ? "c2" : "c1"],
    categoryTagIds: [indice % 3 === 0 ? "k1" : "k2"],
    lists: ["criativa"],
    status: semente.status,
    statusHistory: [{ status: semente.status, enteredAt: AGORA, exitedAt: null }],
    comments: [],
    planId: comPlano ? "plano-1" : undefined,
    planKind: comPlano ? "content" : undefined,
    captacaoId: comPlano ? semente.captacao : undefined,
    sequenceOrder: indice,
    seasonal: semente.nome.startsWith("7 de Setembro"),
    createdAt: AGORA,
    updatedAt: AGORA,
  };
}

export const TAREFAS: Task[] = SEMENTES.map((s, i) => tarefa(s, i, false));
export const TAREFAS_DO_PLANO: Task[] = SEMENTES.map((s, i) => tarefa(s, i, true));

export const PLANO: Plan = {
  id: "plano-1", projectId: "proj-1", title: "Setembro de 2026", kind: "content",
  status: "active", source: "native", createdBy: "m4",
  approvalPeriodDays: 5,
  createdAt: AGORA, updatedAt: AGORA,
};

export const CAPTACOES: PlanCaptacao[] = [
  { id: "cap-1", planId: "plano-1", label: "Captação #1 | Reels", packageKind: "capture", recordingAssigneeId: "m2", editingAssigneeId: "m3", sequenceOrder: 0, createdAt: AGORA },
  { id: "cap-2", planId: "plano-1", label: "Captação #2 | Reels", packageKind: "capture", recordingAssigneeId: "m2", editingAssigneeId: "m3", sequenceOrder: 1, createdAt: AGORA },
  { id: "cap-3", planId: "plano-1", label: "Carrosséis | Educativo", packageKind: "creation", sequenceOrder: 2, createdAt: AGORA },
  { id: "cap-4", planId: "plano-1", label: "Estáticos | sazonais", packageKind: "creation", sequenceOrder: 3, createdAt: AGORA },
];

export const APROVACOES: PlanItemApproval[] = [
  { taskId: "t1", status: "changes_requested", reviewVersion: 1, updatedAt: AGORA },
  { taskId: "t5", status: "approved", reviewVersion: 1, updatedAt: AGORA },
  { taskId: "t2", status: "pending", reviewVersion: 1, updatedAt: AGORA },
];

export const USUARIO = {
  id: "m4", name: "Phedro Borges", email: "phedro@vizantu.com.br",
  role: "dono" as const, aiEnabled: false, active: true,
  accessibleProjectIds: "all" as const, accessibleListKinds: "all" as const,
};
