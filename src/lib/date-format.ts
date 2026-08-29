// Formatos de data do prazo das tarefas. Antes existia só "16 ago" fixo, que
// não diz se é semana que vem ou mês passado sem a pessoa fazer a conta.
// Cada modo é uma escolha de quem está olhando (ver use-date-format.ts), e não
// uma decisão tomada aqui.

import { todayIso } from "./dates";

const TZ = "America/Sao_Paulo";

export const DATE_FORMATS = [
  { key: "inteligente", label: "Inteligente", hint: "hoje, amanhã, depois vira 16 ago" },
  { key: "curto", label: "Curto", hint: "16 ago" },
  { key: "extenso", label: "Por extenso", hint: "16 de agosto" },
  { key: "numerico", label: "Numérico", hint: "16/08/2026" },
  { key: "relativo", label: "Relativo", hint: "amanhã, há 2 dias" },
] as const;

export type DateFormatKey = (typeof DATE_FORMATS)[number]["key"];
export const DEFAULT_DATE_FORMAT: DateFormatKey = "inteligente";

const KEYS = new Set<string>(DATE_FORMATS.map((format) => format.key));
export function isDateFormatKey(value: unknown): value is DateFormatKey {
  return typeof value === "string" && KEYS.has(value);
}

// Datas do banco são "YYYY-MM-DD" puras, sem hora. Ancorar ao meio-dia UTC
// evita que o fuso empurre o dia pra trás na formatação.
function atNoonUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

// Diferença em DIAS DE CALENDÁRIO, não em blocos de 24h: ontem 23h e hoje 1h
// são "1 dia", não "2 horas". Por isso a conta é feita nas strings ISO.
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((atNoonUtc(toIso).getTime() - atNoonUtc(fromIso).getTime()) / MS_PER_DAY);
}

function relativeLabel(days: number): string {
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days === -1) return "ontem";
  if (days === 2) return "depois de amanhã";
  if (days === -2) return "anteontem";
  if (days > 0) return `daqui ${days} dias`;
  return `há ${Math.abs(days)} dias`;
}

function short(date: Date, withYear: boolean): string {
  // O pt-BR devolve "16 de ago." — a forma curta que a tabela usa é "16 ago",
  // então o "de" e o ponto saem.
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: TZ,
  })
    .format(date)
    .replace(/ de /g, " ")
    .replace(/\./g, "");
}

export function formatTaskDate(
  dateStr: string | undefined,
  format: DateFormatKey = DEFAULT_DATE_FORMAT,
  today: string = todayIso(),
): string {
  if (!dateStr) return "Sem prazo";
  const date = atNoonUtc(dateStr);
  const sameYear = dateStr.slice(0, 4) === today.slice(0, 4);

  switch (format) {
    case "curto":
      return short(date, !sameYear);
    case "extenso":
      return new Intl.DateTimeFormat("pt-BR", {
        day: "numeric",
        month: "long",
        ...(sameYear ? {} : { year: "numeric" }),
        timeZone: TZ,
      }).format(date);
    case "numerico":
      return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(date);
    case "relativo":
      return relativeLabel(daysBetweenIso(today, dateStr));
    case "inteligente":
    default: {
      const days = daysBetweenIso(today, dateStr);
      // Dentro da semana o relativo é o que a pessoa precisa saber; fora dela
      // o relativo vira ruído ("daqui 43 dias") e a data volta a ser melhor.
      if (Math.abs(days) <= 7) return relativeLabel(days);
      return short(date, !sameYear);
    }
  }
}
