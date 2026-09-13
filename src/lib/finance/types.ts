import type { Contract, Member, Project, Tag, Task } from "../types";

export const CATEGORIES = {
  servicos: "Serviços recorrentes", campanha: "Campanha / receita avulsa", outras_receitas: "Outras receitas",
  producao: "Produção da equipe", operacional: "Operacional", ferramentas: "Ferramentas", marketing: "Aquisição / marketing",
  prolabore: "Pró-labore", impostos: "Impostos pagos", retiradas: "Distribuição de lucros / retiradas", outros_custos: "Outros custos",
} as const;
export type Category = keyof typeof CATEGORIES;
export type Entry = {
  id: string; direction: "income" | "expense"; category: Category; description: string;
  amount: number; dueDate: string; competence: string; projectId: string | null;
  memberId: string | null; recurring: boolean; seriesId: string | null;
  sourceKey: string | null; cancelled: boolean; notes: string; createdAt: string;
};
export type Payment = { id: string; entryId: string; amount: number; paidAt: string; method: string; reference: string; reversed: boolean };
export type RateKey = "reels" | "estatico" | "carrossel" | "manual" | "canva";
export const RATE_LABELS: Record<RateKey, string> = { reels: "Reels", estatico: "Estático (feed/story)", carrossel: "Carrossel até 8 cards", manual: "Manual de marca", canva: "Apresentação Canva até 15 slides (animada)" };
export type Settings = {
  taxRate: number | null; taxRegime: string; taxBasis: "competence" | "cash";
  openingBalance: number; openingDate: string; targetMargin: number;
  deadlineMode: "calendar" | "business"; penaltyMode: "both" | "either";
  soloDays: number; packageDays: number;
  rates: Record<RateKey, { unit: number; pack: number | null }>; extraCard: number;
};
export const DEFAULT_SETTINGS: Settings = {
  taxRate: null, taxRegime: "", taxBasis: "competence", openingBalance: 0, openingDate: "2026-01-01", targetMargin: 30,
  deadlineMode: "calendar", penaltyMode: "both", soloDays: 1, packageDays: 3, extraCard: 2000,
  rates: { reels: { unit: 7000, pack: 28000 }, estatico: { unit: 5000, pack: 20000 }, carrossel: { unit: 10000, pack: 40000 }, manual: { unit: 35000, pack: null }, canva: { unit: 30000, pack: null } },
};
export type ProductionReview = { taskId: string; rateKey: RateKey | null; cards: number; deliveredDate: string | null; qualityProblem: boolean; notes: string };
export type Block = { projectId: string; blocked: boolean; reason: string; updatedAt: string };
export type Audit = { id: string; action: string; actorId: string | null; createdAt: string; entityId: string };
export type FinanceData = {
  entries: Entry[]; payments: Payment[]; settings: Settings; blocks: Block[]; reviews: ProductionReview[];
  projects: Project[]; members: Member[]; tasks: Task[]; tags: Tag[]; contracts: Contract[];
  scores: { projectId: string; score: number; createdAt: string }[]; audit: Audit[]; warnings: string[];
};
export type EntryInput = Omit<Entry, "id" | "createdAt" | "cancelled">;
