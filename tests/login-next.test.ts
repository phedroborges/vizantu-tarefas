import { describe, expect, it } from "vitest";
import { destinoDoLogin } from "../src/lib/login-next";

describe("destino depois do login", () => {
  it("segue para o link da tarefa que a pessoa abriu", () => {
    expect(destinoDoLogin("/tarefas/5f567e84-7c6f-47f2-825a-e77ba9cb2bad")).toBe("/tarefas/5f567e84-7c6f-47f2-825a-e77ba9cb2bad");
    expect(destinoDoLogin("/planos/abc?aba=calendario")).toBe("/planos/abc?aba=calendario");
  });

  it("sem link, ou com link para fora do app, vai para a tela inicial", () => {
    for (const next of [null, undefined, "", "https://exemplo.com", "//exemplo.com", "/\\exemplo.com", "tarefas/1", "/login", "/login?next=/x"]) {
      expect(destinoDoLogin(next)).toBe("/");
    }
  });
});
