"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { DASHBOARD_PERIOD_PRESETS, type DashboardDayRange, type DashboardPeriod } from "@/lib/dashboard-period";
import { formatDueDate } from "@/lib/dates";
import { VzLoading } from "@/components/vz/loading";

function rangeLabel(range: DashboardDayRange) {
  return range.from === range.to ? formatDueDate(range.from) : `${formatDueDate(range.from)} a ${formatDueDate(range.to)}`;
}

/** Filtro de período de uma tela inteira. O período mora na URL (`?periodo=7d`
 * ou `?de=…&ate=…`); os outros parâmetros da página são preservados.
 *
 * Trocar o período só muda a query, então o loading.tsx da rota não aparece:
 * enquanto o servidor recalcula, a própria barra avisa que está carregando e o
 * CSS esmaece o resto da tela, que ainda mostra os números do período antigo. */
export function PeriodBar({ period, pastNote, children }: { period: DashboardPeriod; pastNote?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(period.range?.from ?? "");
  const [to, setTo] = useState(period.range?.to ?? "");
  // O período que foi pedido e ainda está chegando; o botão dele já acende no clique.
  const [target, setTarget] = useState<string>();
  const loading = pending ? target : undefined;
  const go = (query: Record<string, string>, label: string) => {
    const next = new URLSearchParams(searchParams);
    for (const key of ["periodo", "de", "ate"]) next.delete(key);
    for (const [key, value] of Object.entries(query)) next.set(key, value);
    setTarget(label);
    startTransition(() => router.push(`${pathname}?${next}`, { scroll: false }));
  };
  return <section className={`dash-period${pending ? " is-pending" : ""}`} aria-label="Período das métricas" aria-busy={pending}>
    <div className="dash-period__presets">{DASHBOARD_PERIOD_PRESETS.map((preset) => <button type="button" key={preset.value} className={(loading ? preset.label === loading : preset.value === period.preset) ? "is-active" : ""} aria-pressed={preset.value === period.preset} onClick={() => go({ periodo: preset.value }, preset.label)}>{preset.label}</button>)}</div>
    <form className={`dash-period__custom${period.preset === "personalizado" ? " is-active" : ""}`} onSubmit={(event) => { event.preventDefault(); go({ ...(from ? { de: from } : {}), ...(to ? { ate: to } : {}) }, "período personalizado"); }}>
      <label><span>De</span><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
      <label><span>Até</span><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      <button type="submit" className="secondary-button" disabled={!from && !to}>Aplicar</button>
    </form>
    {pending ? <p className="dash-period__summary"><VzLoading size="inline" label={`Carregando os dados de ${(loading ?? "período").toLowerCase()}…`} /></p> : <p className="dash-period__summary">
      <strong>{period.label}</strong>
      {period.range && period.previous
        ? <> · {rangeLabel(period.range)} ({period.days === 1 ? "1 dia" : `${period.days} dias`}). Comparando com {rangeLabel(period.previous)}.{period.endsInPast && pastNote ? ` ${pastNote}` : ""}</>
        : <> · histórico inteiro, sem comparação com período anterior.</>}
      {children}
    </p>}
  </section>;
}

/** Variação de um número contra o período anterior. Tempo e contagem variam em
 * percentual; o que já é percentual varia em pontos. */
export function PeriodDelta({ current, previous, mode, format, lowerIsBetter = false }: { current?: number; previous?: number; mode: "percent" | "points" | "count"; format: (value: number) => string; lowerIsBetter?: boolean }) {
  if (current === undefined) return null;
  if (previous === undefined) return <em className="period-delta">sem base no período anterior</em>;
  const before = `Período anterior: ${format(previous)}`;
  const diff = current - previous;
  if (diff === 0) return <em className="period-delta" title={before}>igual ao período anterior</em>;
  const size = Math.abs(diff);
  const percent = Math.round((size / previous) * 100);
  const text = mode === "points" ? `${size} p.p.` : mode === "count" ? String(size) : previous === 0 ? format(size) : percent ? `${percent}%` : "menos de 1%";
  return <em className={`period-delta ${(diff < 0) === lowerIsBetter ? "is-good" : "is-bad"}`} title={before}>{diff > 0 ? "↑" : "↓"} {text} <span>vs. período anterior</span></em>;
}
