// Diagnóstico no log do container, sem URL, filtros, corpos, cookies ou chaves.
// Medimos até os cabeçalhos; desserialização e renderização ficam fora daqui.
export function timedSupabaseFetch(service: "database" | "auth", baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const started = performance.now();
    let status: number | undefined;
    try {
      // Uma conexão pendurada não deve deixar a tela carregando para sempre.
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      // Escritas e uploads têm mais tempo para terminar sem interromper arquivos.
      const timeout = AbortSignal.timeout(method === "GET" || method === "HEAD" ? 15_000 : 60_000);
      const signal = init?.signal || (input instanceof Request ? input.signal : undefined);
      const response = await baseFetch(input, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
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
