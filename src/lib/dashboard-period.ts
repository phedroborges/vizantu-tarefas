// Período do dashboard. Tudo aqui é dia de calendário de São Paulo: o filtro
// vai do começo do primeiro dia ao fim do último, e a comparação usa a mesma
// quantidade de dias imediatamente antes.

const DAY = 86_400_000;
// O Brasil não tem mais horário de verão: São Paulo é UTC-3 o ano inteiro.
const SP_OFFSET = 3 * 3_600_000;

export const DASHBOARD_PERIOD_PRESETS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mes-passado", label: "Mês passado" },
  { value: "tudo", label: "Todo o período" },
] as const;

export type DashboardPeriodPreset = (typeof DASHBOARD_PERIOD_PRESETS)[number]["value"] | "personalizado";
export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriodPreset = "30d";

export type DashboardDayRange = { from: string; to: string };

export type DashboardPeriod = {
  preset: DashboardPeriodPreset;
  label: string;
  /** Ausente em "Todo o período", que não tem começo nem comparação. */
  range?: DashboardDayRange;
  /** A mesma quantidade de dias, imediatamente antes do período. */
  previous?: DashboardDayRange;
  days?: number;
  /** O período termina antes de hoje: os números de situação (carga aberta,
   * atrasos) são os do último dia dele, e não os de agora. */
  endsInPast: boolean;
};

function dayToUtc(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

function utcToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function shiftDay(day: string, amount: number): string {
  return utcToDay(dayToUtc(day) + amount * DAY);
}

function validDay(value?: string): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  // "2026-02-31" passa na expressão, mas não é um dia.
  return utcToDay(dayToUtc(value)) === value ? value : undefined;
}

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function presetRange(preset: DashboardPeriodPreset, today: string): DashboardDayRange | undefined {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case "hoje": return { from: today, to: today };
    case "ontem": return { from: shiftDay(today, -1), to: shiftDay(today, -1) };
    case "7d": return { from: shiftDay(today, -6), to: today };
    case "30d": return { from: shiftDay(today, -29), to: today };
    case "mes": return { from: monthStart, to: today };
    case "mes-passado": {
      const to = shiftDay(monthStart, -1);
      return { from: `${to.slice(0, 7)}-01`, to };
    }
    default: return undefined;
  }
}

/** Lê o período da URL: `?periodo=7d` ou `?de=2026-09-01&ate=2026-09-15`. */
export function resolveDashboardPeriod(
  params: { periodo?: string | string[]; de?: string | string[]; ate?: string | string[] },
  today: string,
): DashboardPeriod {
  const de = validDay(first(params.de));
  const ate = validDay(first(params.ate));
  let preset: DashboardPeriodPreset;
  let range: DashboardDayRange | undefined;
  if (de || ate) {
    preset = "personalizado";
    // Só uma das pontas: "de" vai até hoje, "até" vira um dia só.
    let from = de ?? ate!;
    let to = ate ?? today;
    if (from > to) [from, to] = [to, from];
    // Dia que ainda não aconteceu não tem dado e só encolheria a comparação.
    if (to > today) to = today;
    if (from > today) from = today;
    range = { from, to };
  } else {
    const requested = first(params.periodo);
    preset = DASHBOARD_PERIOD_PRESETS.find((item) => item.value === requested)?.value ?? DEFAULT_DASHBOARD_PERIOD;
    range = presetRange(preset, today);
  }
  const label = preset === "personalizado" ? "Personalizado" : DASHBOARD_PERIOD_PRESETS.find((item) => item.value === preset)!.label;
  if (!range) return { preset, label, endsInPast: false };
  const days = Math.round((dayToUtc(range.to) - dayToUtc(range.from)) / DAY) + 1;
  return {
    preset,
    label,
    range,
    previous: { from: shiftDay(range.from, -days), to: shiftDay(range.from, -1) },
    days,
    endsInPast: range.to < today,
  };
}

/** Os instantes que delimitam os dias: 00:00 do primeiro ao último
 * milissegundo do último, no fuso de São Paulo. */
export function dayRangeInstants(range: DashboardDayRange): { fromIso: string; toIso: string } {
  return {
    fromIso: new Date(dayToUtc(range.from) + SP_OFFSET).toISOString(),
    toIso: new Date(dayToUtc(range.to) + SP_OFFSET + DAY - 1).toISOString(),
  };
}
