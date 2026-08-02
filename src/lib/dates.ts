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
