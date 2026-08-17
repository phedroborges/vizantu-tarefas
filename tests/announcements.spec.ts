import { expect, test } from "@playwright/test";
import { loginAsTestDono, loginAsTestViewer, reloadAndWaitForAnnouncements } from "./helpers";

test.describe("Aviso — broadcast com confirmação obrigatória", () => {
  test("1. escopo 'all' bloqueia o usuário até confirmar, e depois some", async ({ page }) => {
    await loginAsTestDono(page);
    await page.request.post("/api/announcements", { data: { body: "[E2E] Aviso para todos", scope: "all" } });
    await reloadAndWaitForAnnouncements(page);
    await expect(page.getByText("[E2E] Aviso para todos")).toBeVisible();
    await page.getByRole("button", { name: "Ok, entendi" }).click();
    await expect(page.getByText("[E2E] Aviso para todos")).toBeHidden();
  });

  test("2. escopo 'role' só aparece pra quem tem aquele papel", async ({ page }) => {
    await loginAsTestDono(page);
    await page.request.post("/api/announcements", { data: { body: "[E2E] Aviso pra visualizador", scope: "role", scopeRole: "visualizador" } });

    // dono não deveria ver este aviso.
    await reloadAndWaitForAnnouncements(page);
    await expect(page.getByText("[E2E] Aviso pra visualizador")).toBeHidden();
  });

  test("3. escopo 'role' aparece pro visualizador de verdade (mostrado na fila, um por vez)", async ({ page }) => {
    await loginAsTestViewer(page);
    const okButton = page.getByRole("button", { name: "Ok, entendi" });
    // O visualizador também pode ter o aviso "para todos" do teste 1 ainda
    // pendente (fila é por usuário) — a fila mostra um de cada vez, então
    // confirma até o texto do teste aparecer, comprovando que ele está
    // mesmo na fila e não foi perdido.
    for (let i = 0; i < 5; i++) {
      await expect(okButton).toBeVisible({ timeout: 10_000 });
      if (await page.getByText("[E2E] Aviso pra visualizador").isVisible()) break;
      await okButton.click();
    }
    await expect(page.getByText("[E2E] Aviso pra visualizador")).toBeVisible();
    await okButton.click();
    await expect(page.getByText("[E2E] Aviso pra visualizador")).toBeHidden();
  });

  test("4. ack persiste — não reaparece depois de recarregar/relogar", async ({ page }) => {
    await loginAsTestDono(page);
    await page.request.post("/api/announcements", { data: { body: "[E2E] Aviso persistente", scope: "all" } });
    await reloadAndWaitForAnnouncements(page);
    await expect(page.getByText("[E2E] Aviso persistente")).toBeVisible();
    await page.getByRole("button", { name: "Ok, entendi" }).click();
    await expect(page.getByText("[E2E] Aviso persistente")).toBeHidden();
    await reloadAndWaitForAnnouncements(page);
    await expect(page.getByText("[E2E] Aviso persistente")).toBeHidden();
  });

  test("5. não some sozinho — só o clique no botão confirma (checa via API que continua pendente)", async ({ page }) => {
    await loginAsTestDono(page);
    await page.request.post("/api/announcements", { data: { body: "[E2E] Aviso sem clique", scope: "all" } });
    await reloadAndWaitForAnnouncements(page);
    await expect(page.getByText("[E2E] Aviso sem clique")).toBeVisible();
    // Nenhuma ação além do botão foi tomada — a API deve continuar
    // reportando o aviso como pendente pra este usuário.
    const pending = await (await page.request.get("/api/announcements?pending=1")).json();
    expect(pending.announcements.some((a: { body: string }) => a.body === "[E2E] Aviso sem clique")).toBe(true);
    await page.getByRole("button", { name: "Ok, entendi" }).click();
  });
});
