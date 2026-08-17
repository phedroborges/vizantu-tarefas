import { expect, test } from "@playwright/test";
import { fixtures, loginAsTestDono } from "./helpers";

// Prova a automação estratégica ⇄ criativa (deriveListsForStatus em
// storage.ts) fim a fim: cria/edita tarefas via API real contra o banco de
// teste isolado, checando o campo `lists` que a UI usa pra decidir em qual
// lista a tarefa aparece.
test.describe("automação estratégica ⇄ criativa", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestDono(page);
  });

  test("1. tarefa nova em rascunho nasce estratégica", async ({ page }) => {
    const { projectId } = fixtures();
    const response = await page.request.post("/api/tasks", { data: { projectId, name: "Teste 1", status: "rascunho" } });
    expect(response.ok()).toBeTruthy();
    const { task } = await response.json();
    expect(task.lists).toEqual(["estrategica"]);
  });

  test("2. avançar pra pronto_para_criacao move pra criativa", async ({ page }) => {
    const { projectId } = fixtures();
    const created = await (await page.request.post("/api/tasks", { data: { projectId, name: "Teste 2", status: "rascunho" } })).json();
    const patched = await (
      await page.request.patch(`/api/tasks/${created.task.id}`, { data: { status: "pronto_para_criacao" } })
    ).json();
    expect(patched.task.lists).toEqual(["criativa"]);
  });

  test("3. voltar o status pro grupo não iniciada reverte pra estratégica", async ({ page }) => {
    const { projectId } = fixtures();
    const created = await (
      await page.request.post("/api/tasks", { data: { projectId, name: "Teste 3", status: "em_criacao" } })
    ).json();
    expect(created.task.lists).toEqual(["criativa"]);
    const patched = await (
      await page.request.patch(`/api/tasks/${created.task.id}`, { data: { status: "aguardando_informacao" } })
    ).json();
    expect(patched.task.lists).toEqual(["estrategica"]);
  });

  test("4. transição dentro do mesmo grupo (revisão -> ajuste) permanece criativa", async ({ page }) => {
    const { projectId } = fixtures();
    const created = await (await page.request.post("/api/tasks", { data: { projectId, name: "Teste 4", status: "revisao" } })).json();
    const patched = await (await page.request.patch(`/api/tasks/${created.task.id}`, { data: { status: "ajuste" } })).json();
    expect(patched.task.lists).toEqual(["criativa"]);
  });

  test("5. PATCH sem mudar o status não mexe em lists, e chegar em 'feita' também é criativa", async ({ page }) => {
    const { projectId } = fixtures();
    const created = await (
      await page.request.post("/api/tasks", { data: { projectId, name: "Teste 5", status: "finalizado" } })
    ).json();
    expect(created.task.lists).toEqual(["criativa"]);
    const patched = await (
      await page.request.patch(`/api/tasks/${created.task.id}`, { data: { description: "só mudando a descrição" } })
    ).json();
    expect(patched.task.lists).toEqual(["criativa"]);
  });
});
