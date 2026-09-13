import type { Contract, Member, Project, Tag, Task } from "../types";

export const CATEGORIES = {
  servicos: "Serviços recorrentes", campanha: "Campanha / receita avulsa", outras_receitas: "Outras receitas",
  producao: "Produção da equipe", operacional: "Operacional", ferramentas: "Ferramentas", marketing: "Aquisição / marketing",
  prolabore: "Pró-labore", impostos: "Impostos pagos", retiradas: "Distribuição de lucros / retiradas", outros_custos: "Outros custos",
} as const;
export type Category = keyof typeof CATEGORIES;
export type Entry = {
  id: string; direction: "income" | "expense"; category: Category; description: string;
  amount: number; competence: string; projectId: string | null;
  memberId: string | null; recurring: boolean; seriesId: string | null;
  sourceKey: string | null; cancelled: boolean; notes: string; createdAt: string;
};
export type RateKey = "reels" | "estatico" | "carrossel" | "manual" | "canva";
export const RATE_LABELS: Record<RateKey, string> = { reels: "Reels", estatico: "Estático (feed/story)", carrossel: "Carrossel até 8 cards", manual: "Manual de marca", canva: "Apresentação Canva até 15 slides (animada)" };
export type Settings = {
  taxRate: number | null; taxRegime: string; targetMargin: number;
  deadlineMode: "calendar" | "business"; penaltyMode: "both" | "either";
  soloDays: number; packageDays: number;
  // Percentual aplicado a cada 12 parcelas de contrato recorrente. É uma taxa
  // fixa configurada, não um índice buscado em lugar nenhum: ninguém aqui
  // consulta IPCA automaticamente, e fingir que consulta seria pior que zero.
  annualAdjustment: number;
  rates: Record<RateKey, { unit: number; pack: number | null }>; extraCard: number;
};
export const DEFAULT_SETTINGS: Settings = {
  // 6% sobre o faturamento, informado pela Vizantu. Alíquota efetiva: não há
  // apuração de Simples nem envio fiscal aqui.
  taxRate: 6, taxRegime: "", targetMargin: 30,
  deadlineMode: "calendar", penaltyMode: "both", soloDays: 1, packageDays: 3, extraCard: 2000, annualAdjustment: 0,
  rates: { reels: { unit: 7000, pack: 28000 }, estatico: { unit: 5000, pack: 20000 }, carrossel: { unit: 10000, pack: 40000 }, manual: { unit: 35000, pack: null }, canva: { unit: 30000, pack: null } },
};
// Só quem produz peça entra no cálculo de produção: editor de vídeo e designer,
// que no app são diretor_criativo. Social media e dono não recebem por tarefa —
// o trabalho deles não é medido em peça entregue.
export const CARGOS_QUE_PRODUZEM = ["diretor_criativo"] as const;

export type ClientMargin = {
  projectId: string; revenue: number; tax: number | null; production: number;
  tools: number; result: number | null; margin: number | null;
};
// Um contrato visto de cima: quanto vale por mês, quando acaba e quanto ainda
// falta entrar. É o que o dono pediu no lugar do fluxo de caixa.
export type ContractSummary = {
  projectId: string; seriesId: string | null; description: string;
  monthly: number; first: string; last: string; monthsLeft: number; remaining: number;
};
// O fechamento de um diretor criativo no mês: quantas peças, de que tipo,
// quanto já virou despesa e quanto ainda falta lançar.
export type ProducerClosing = {
  producerId: string; pieces: number; penalized: number;
  byFormat: { rateKey: RateKey; count: number; total: number }[];
  launched: number; pending: number; total: number; pendingTaskIds: string[];
};
export type ProductionReview = { taskId: string; rateKey: RateKey | null; cards: number; deliveredDate: string | null; qualityProblem: boolean; notes: string };
export type Block = { projectId: string; blocked: boolean; reason: string; updatedAt: string };
export type Audit = { id: string; action: string; actorId: string | null; createdAt: string; entityId: string };
export type FinanceData = {
  entries: Entry[]; settings: Settings; blocks: Block[]; reviews: ProductionReview[];
  projects: Project[]; members: Member[]; tasks: Task[]; tags: Tag[]; contracts: Contract[];
  scores: { projectId: string; score: number; createdAt: string }[]; audit: Audit[]; warnings: string[];
};
export type EntryInput = Omit<Entry, "id" | "createdAt" | "cancelled">;
