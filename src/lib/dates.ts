import { DONE_STATUSES, type StatusHistoryEntry, type TaskStatus } from "./types";

const TZ = "America/Sao_Paulo";
const DONE_SET = new Set<TaskStatus>(DONE_STATUSES);

export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ,
  }).format(new Date());
}

export function monthKeyFromDate(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function currentMonthKey(): string {
  return todayIso().slice(0, 7);
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: TZ }).format(
    new Date(Date.UTC(year, month - 1, 15)),
  );
}

export function moveMonth(key: string, amount: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 15));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInCalendarMonth(key: string): (number | null)[] {
  const [year, month] = key.split("-").map(Number);
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  return [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
}

export function formatDueDate(dateStr?: string): string {
  if (!dateStr) return "Sem prazo";
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TZ }).format(
    new Date(Date.UTC(year, month - 1, day, 12)),
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function isOverdue(dueDate: string | undefined, status: TaskStatus): boolean {
  if (!dueDate || DONE_SET.has(status)) return false;
  return dueDate < todayIso();
}

export type StatusDuration = { status: TaskStatus; totalMs: number; visits: number };

// Soma a duração de cada status em TODAS as visitas (não só a última), pra dar o
// tempo cumulativo mesmo quando a tarefa vai e volta entre status.
export function summarizeStatusDurations(history: StatusHistoryEntry[], nowMs: number = Date.now()): StatusDuration[] {
  const totals = new Map<TaskStatus, StatusDuration>();
  for (const entry of history) {
    const start = new Date(entry.enteredAt).getTime();
    const end = entry.exitedAt ? new Date(entry.exitedAt).getTime() : nowMs;
    const current = totals.get(entry.status) ?? { status: entry.status, totalMs: 0, visits: 0 };
    current.totalMs += Math.max(0, end - start);
    current.visits += 1;
    totals.set(entry.status, current);
  }
  return Array.from(totals.values());
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "menos de 1min";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", !days && mins ? `${mins}min` : ""].filter(Boolean).join(" ");
}

// Quantos dias de atraso — 0 se não está atrasada. Usado pra ordenar as
// atrasadas da mais velha pra mais nova no topo da lista.
export function overdueDays(dueDate: string | undefined, status: TaskStatus, today: string = todayIso()): number {
  // A comparação é feita aqui, e não via isOverdue(), porque aquela função lê
  // o dia de hoje por conta própria e ignoraria o `today` recebido — o que
  // torna esta impossível de testar com data fixa.
  if (!dueDate || DONE_SET.has(status) || dueDate >= today) return 0;
  const [ay, am, ad] = today.split("-").map(Number);
  const [by, bm, bd] = dueDate!.split("-").map(Number);
  const MS_PER_DAY = 86_400_000;
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / MS_PER_DAY);
}

// Horas restantes até o fim do dia do prazo (23:59:59 no fuso de São Paulo).
// Negativo quando já passou. Alimenta o contador do dashboard.
export function hoursUntilDue(dueDate: string, now: Date = new Date()): number {
  const [year, month, day] = dueDate.split("-").map(Number);
  // O fim do dia em São Paulo (UTC-3) é 02:59:59 UTC do dia seguinte.
  const deadlineUtc = Date.UTC(year, month - 1, day, 23 + 3, 59, 59);
  return (deadlineUtc - now.getTime()) / 3_600_000;
}

// "faltam 5h", "faltam 2 dias", "vence hoje", "atrasada há 3 dias".
export function timeUntilDueLabel(dueDate: string, now: Date = new Date()): string {
  const hours = hoursUntilDue(dueDate, now);
  if (hours < 0) {
    // Atraso é contado em DIAS DE CALENDÁRIO, igual à coluna de prazo. Medir
    // pelas horas desde o fim do dia dava um dia a menos que a tabela ("há 11
    // dias" ao lado de "12 dias"), e duas contas diferentes pro mesmo atraso
    // na mesma tela destroem a confiança nas duas.
    const hojeIso = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ }).format(now);
    const [ay, am, ad] = hojeIso.split("-").map(Number);
    const [by, bm, bd] = dueDate.split("-").map(Number);
    const days = Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
    if (days >= 1) return `atrasada há ${days} ${days === 1 ? "dia" : "dias"}`;
    return `atrasada há ${Math.max(1, Math.floor(-hours))}h`;
  }
  if (hours < 1) return `faltam ${Math.max(1, Math.round(hours * 60))}min`;
  if (hours < 24) return `faltam ${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  return `faltam ${days} ${days === 1 ? "dia" : "dias"}`;
}
