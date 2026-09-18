import { afterEach, expect, it, vi } from "vitest";
import { timedSupabaseFetch } from "@/lib/supabase/timed-fetch";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it("registra duração sem vazar URL, parâmetros ou credenciais", async () => {
  vi.stubEnv("APP_SLOW_QUERY_MS", "100");
  vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(250);
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const response = new Response("[]");
  const wrapped = timedSupabaseFetch("database", vi.fn().mockResolvedValue(response));
  expect(await wrapped("https://db.example/rest/v1/tasks?name=eq.sensitive", { headers: { Authorization: "secret" } })).toBe(response);
  expect(log).toHaveBeenCalledWith(JSON.stringify({ event: "slow_supabase_request", service: "database", durationMs: 250, status: 200 }));
});
it("não cria ruído para chamadas rápidas e preserva erro de rede", async () => {
  vi.spyOn(performance, "now").mockReturnValue(0);
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  const error = new Error("network failed");
  await expect(timedSupabaseFetch("auth", vi.fn().mockRejectedValue(error))("https://db.example")).rejects.toBe(error);
  expect(log).not.toHaveBeenCalled();
});
it("limita conexões penduradas sem perder o cancelamento do chamador", async () => {
  const timeout = new AbortController();
  const caller = new AbortController();
  const spy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
  const base = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]"));
  await timedSupabaseFetch("database", base)("https://db.example", { signal: caller.signal });
  const effective = base.mock.calls[0][1]!.signal!;
  expect(spy).toHaveBeenCalledWith(15_000);
  caller.abort();
  expect(effective.aborted).toBe(true);
  await timedSupabaseFetch("database", base)("https://db.example");
  timeout.abort(new DOMException("Timed out", "TimeoutError"));
  expect(base.mock.calls[1][1]!.signal!.aborted).toBe(true);
});

it("reserva mais tempo para escritas e uploads do que para leituras", async () => {
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);
  await timedSupabaseFetch("database", vi.fn().mockResolvedValue(new Response("[]")))("https://db.example/storage", { method: "POST" });
  expect(timeout).toHaveBeenCalledWith(60_000);
});
