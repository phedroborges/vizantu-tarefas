import { currentMonthKey } from "./dates";

// A data de entrega não muda o plano. A escolha explícita sempre prevalece.

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

/** Sem escolha explícita, usa o mês atual. O prazo não determina o plano. */
export function targetMonth(_task: { kind: string; dueDate?: string | null }, plan?: { periodMonth?: string | null }, month = currentMonthKey()): string | null {
  return plan ? null : month;
}

export function isPlanClosed(plan: { periodMonth?: string | null; status?: string }, month = currentMonthKey()): boolean {
  return plan.status === "archived" || plan.status === "completed" || Boolean(plan.periodMonth && plan.periodMonth < month);
}

export function isClientPlanAvailable(plan: { periodMonth?: string | null; status?: string; kind?: string }, month = currentMonthKey()): boolean {
  return (plan.kind === "content" || plan.kind === "process") && !isPlanClosed(plan, month);
}
