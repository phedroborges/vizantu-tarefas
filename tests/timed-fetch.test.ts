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
