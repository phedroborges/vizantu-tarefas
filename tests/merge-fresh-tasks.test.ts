import { describe, expect, it } from "vitest";
import { mergeFreshTasks } from "../src/lib/merge-fresh-tasks";
import type { Task } from "../src/lib/types";

function task(id: string, patch: Partial<Task> = {}): Task {
  return { id, projectId: "p1", name: `Tarefa ${id}`, kind: "conteudo", createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z", status: "rascunho", statusHistory: [], images: [], formatTagIds: [], channelTagIds: [], categoryTagIds: [], lists: [], comments: [], ...patch };
}

describe("atualização da lista em segundo plano", () => {
  it("traz o que mudou no servidor: nova entra, alterada troca, excluída sai", () => {
    const merged = mergeFreshTasks(
      [task("a"), task("b"), task("c")],
      [task("d"), task("a", { status: "aprovado" }), task("c")],
    );
    expect(merged.map((item) => item.id)).toEqual(["d", "a", "c"]);
    expect(merged[1].status).toBe("aprovado");
  });

  // O modal é quem manda na tarefa aberta: trocar ela por baixo desfaria o
  // que a pessoa está editando.
  it("não mexe na tarefa aberta", () => {
    const open = task("a", { name: "Editando agora" });
    const merged = mergeFreshTasks([open, task("b")], [task("a", { name: "Versão do servidor" }), task("b")], "a");
    expect(merged[0]).toBe(open);
  });

  it("mantém a tarefa aberta mesmo que ela tenha sumido do servidor", () => {
    const open = task("a");
    const merged = mergeFreshTasks([open, task("b")], [task("b")], "a");
    expect(merged.map((item) => item.id)).toEqual(["a", "b"]);
    expect(merged[0]).toBe(open);
  });

  // As contagens vêm de outra consulta; sem reaproveitar, o calendário
  // buscaria tudo de novo a cada rodada.
  it("reaproveita as contagens do calendário", () => {
    const merged = mergeFreshTasks(
      [task("a", { preview: true, commentCount: 3, imageCount: 2 })],
      [task("a", { preview: true, status: "aprovado" })],
    );
    expect(merged[0]).toMatchObject({ status: "aprovado", commentCount: 3, imageCount: 2 });
  });
});
