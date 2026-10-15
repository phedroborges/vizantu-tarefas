// Plano mensal: todo mês cada cliente tem um plano próprio, criado sozinho. O
// conteúdo cai no plano do mês da sua data de entrega. Plano de campanha
// (Black Friday, lançamento) não tem mês e nunca é mexido por esta regra.

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

/** "2026-10-23" → "2026-10". Data inválida ou ausente → null. */
export function monthOfDate(date?: string | null): string | null {
  const month = date?.slice(0, 7);
  return isMonth(month) ? month : null;
}

/** "2026-10" → "Outubro de 2026". */
export function monthLabel(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;
}

/** Título que a casa já usa nos planos mensais: "Casa Caramelo | 10/26". */
export function monthlyPlanTitle(projectName: string, month: string): string {
  return `${projectName} | ${month.slice(5, 7)}/${month.slice(2, 4)}`;
}

/** Nome que o cliente vê: "Plano de Outubro de 2026" ou o título da campanha. */
export function planDisplayName(plan: { title: string; periodMonth?: string | null }): string {
  return isMonth(plan.periodMonth) ? `Plano de ${monthLabel(plan.periodMonth)}` : plan.title;
}

/** Em qual plano mensal a tarefa deve estar, ou null quando já está certa (ou
 * quando não é caso de plano mensal). Só entra quem já está num plano mensal,
 * ou é conteúdo avulso com data. Campanha, marca e processo ficam onde estão. */
export function targetMonth(task: { kind: string; dueDate?: string | null }, plan?: { periodMonth?: string | null }): string | null {
  const month = monthOfDate(task.dueDate);
  if (!month) return null;
  if (plan) return isMonth(plan.periodMonth) && plan.periodMonth !== month ? month : null;
  return task.kind === "conteudo" ? month : null;
}
