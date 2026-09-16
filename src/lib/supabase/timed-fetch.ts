// Diagnóstico no log do container, sem URL, filtros, corpos, cookies ou chaves.
// Medimos até os cabeçalhos; desserialização e renderização ficam fora daqui.
export function timedSupabaseFetch(service: "database" | "auth", baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const started = performance.now();
    let status: number | undefined;
    try {
      const response = await baseFetch(input, init);
      status = response.status;
      return response;
    } finally {
      const configured = Number(process.env.APP_SLOW_QUERY_MS ?? 1000);
      const threshold = Number.isFinite(configured) && configured > 0 ? configured : 1000;
      const durationMs = Math.round(performance.now() - started);
      if (durationMs >= threshold) {
        console.warn(JSON.stringify({ event: "slow_supabase_request", service, durationMs, status: status ?? "network_error" }));
      }
    }
  };
}
