import { describe, expect, it } from "vitest";
import { failureMessage } from "../src/lib/api-error";
import { networkError, responseError } from "../src/lib/request-error";

const html = (status: number) =>
  new Response("<!DOCTYPE html><html><body>Internal Server Error</body></html>", {
    status,
    headers: { "Content-Type": "text/html" },
  });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("o erro que chega na tela", () => {
  it("1. coluna faltando no banco vira uma frase que diz o que fazer", () => {
    const message = failureMessage(new Error("Could not find the 'kind' column of 'tasks' in the schema cache"), "salvar a tarefa");
    expect(message).toContain("Não foi possível salvar a tarefa");
    expect(message).toContain("kind");
    expect(message).toContain("migration");
  });

  it("2. causa que a gente não previu volta com o texto do banco, não com uma frase inventada", () => {
    expect(failureMessage(new Error("permission denied for table tasks"), "salvar a tarefa"))
      .toContain("permission denied for table tasks");
  });

  it("3. erro conhecido do banco chega em português", () => {
    expect(failureMessage(new Error('insert or update violates foreign key constraint "tasks_project_id_fkey"'), "criar a tarefa"))
      .toContain("não existe mais no banco");
  });

  it("4. quando a rota explica o motivo, é o motivo dela que aparece", async () => {
    expect(await responseError(json(400, { error: "Informe o nome da tarefa." }), "salvar a tarefa"))
      .toBe("Informe o nome da tarefa.");
  });

  it("5. resposta que não é JSON não vira mais 'falha de conexão'", async () => {
    const message = await responseError(html(500), "salvar a tarefa");
    expect(message).toContain("Não foi possível salvar a tarefa");
    expect(message).toContain("500");
    expect(message.toLowerCase()).not.toContain("conexão");
  });

  it("6. sessão vencida e falta de permissão dizem o que são", async () => {
    expect(await responseError(html(401), "salvar a tarefa")).toContain("sessão expirou");
    expect(await responseError(html(403), "excluir a tarefa")).toContain("não permite excluir a tarefa");
  });

  it("7. só o fetch que estoura fala em conexão", () => {
    expect(networkError("salvar a tarefa")).toContain("confira sua conexão");
  });

  it("8. nenhuma mensagem usa travessão (padrão de escrita da casa)", async () => {
    const messages = [
      failureMessage(new Error("Could not find the 'kind' column of 'tasks'"), "salvar a tarefa"),
      await responseError(html(500), "salvar a tarefa"),
      await responseError(html(404), "salvar a tarefa"),
      networkError("salvar a tarefa"),
    ];
    for (const message of messages) expect(message).not.toMatch(/[—–]/);
  });
});
