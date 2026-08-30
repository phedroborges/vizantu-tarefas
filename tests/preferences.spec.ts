import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { fixtures, loginAsTestDono, loginAsTestViewer } from "./helpers";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// O jeito de ver é de cada pessoa; as cores são do time. Estes testes travam
// as duas metades contra o servidor de verdade.
const PADRAO = { taskView: "lista", taskColumns: null, dateFormat: "inteligente", showFinalized: false };

test.describe("preferências de exibição", () => {
  test("1. seguem a conta, não o navegador", async ({ page }) => {
    await loginAsTestDono(page);

    const saved = await page.request.patch("/api/preferences", {
      data: { taskView: "calendario", dateFormat: "relativo", taskColumns: ["status", "assignee"] },
    });
    expect(saved.ok()).toBeTruthy();
    expect((await saved.json()).preferences.taskView).toBe("calendario");

    // Contexto limpo (sem localStorage nenhum), mesma conta: a preferência veio junto.
    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await loginAsTestDono(page);
    const reread = await (await page.request.get("/api/preferences")).json();
    expect(reread.preferences.taskView).toBe("calendario");
    expect(reread.preferences.dateFormat).toBe("relativo");
    expect(reread.preferences.taskColumns).toEqual(["status", "assignee"]);

    // E a tela abre já no calendário, sem passar pela lista antes.
    await page.goto("/tarefas");
    await expect(page.getByRole("tab", { name: "Calendário" })).toHaveAttribute("aria-selected", "true");
  });

  test("2. PATCH parcial não derruba o resto", async ({ page }) => {
    await loginAsTestDono(page);
    await page.request.patch("/api/preferences", { data: PADRAO });
    await page.request.patch("/api/preferences", { data: { taskView: "calendario", showFinalized: true } });
    await page.request.patch("/api/preferences", { data: { dateFormat: "numerico" } });
    const { preferences } = await (await page.request.get("/api/preferences")).json();
    expect(preferences.taskView).toBe("calendario");
    expect(preferences.showFinalized).toBe(true);
    expect(preferences.dateFormat).toBe("numerico");
  });

  test("3. a preferência de uma pessoa não vaza pra outra", async ({ page }) => {
    await loginAsTestDono(page);
    await page.request.patch("/api/preferences", { data: { ...PADRAO, taskView: "calendario" } });

    await page.context().clearCookies();
    await loginAsTestViewer(page);
    await page.request.patch("/api/preferences", { data: PADRAO });
    const { preferences } = await (await page.request.get("/api/preferences")).json();
    expect(preferences.taskView).toBe("lista"); // padrão, não o do dono

    await page.request.patch("/api/preferences", { data: { taskView: "calendario", showFinalized: true } });
    await page.context().clearCookies();
    await loginAsTestDono(page);
    const dono = await (await page.request.get("/api/preferences")).json();
    expect(dono.preferences.showFinalized).toBe(false); // o do visualizador não encostou aqui
  });

  test("4. cor de status é do time: visualizador não altera", async ({ page }) => {
    await loginAsTestViewer(page);
    const response = await page.request.post("/api/status-colors", { data: { colors: { finalizado: "#123456" } } });
    expect(response.status()).toBe(403);
  });

  test("5. e o dono altera normalmente", async ({ page }) => {
    await loginAsTestDono(page);
    const before = await (await page.request.get("/api/status-colors")).json();
    const original = before.colors.find((c: { status: string }) => c.status === "finalizado")?.color;

    const response = await page.request.post("/api/status-colors", { data: { colors: { finalizado: "#123456" } } });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).colors.find((c: { status: string }) => c.status === "finalizado").color).toBe("#123456");

    if (original) await page.request.post("/api/status-colors", { data: { colors: { finalizado: original } } });
  });

  // O caso que de fato mudou: até aqui a rota aceitava ["dono", "editor"], e os
  // três editores do time podiam repintar os status de todo mundo.
  test("6. editor também não altera as cores do time", async ({ page }) => {
    const { memberId } = fixtures();
    await db.from("members").update({ role: "editor" }).eq("id", memberId);
    try {
      await loginAsTestDono(page); // mesma conta, agora com papel de editor
      const response = await page.request.post("/api/status-colors", { data: { colors: { finalizado: "#123456" } } });
      expect(response.status()).toBe(403);

      // Mas o jeito de ver dele continua sendo dele — isso não é privilégio.
      const own = await page.request.patch("/api/preferences", { data: { taskView: "calendario" } });
      expect(own.ok()).toBeTruthy();
    } finally {
      await db.from("members").update({ role: "dono" }).eq("id", memberId);
    }
  });

  // A virada: quem já configurava colunas/formato na versão do localStorage não
  // pode perder isso, e o navegador tem que sair limpo.
  test("7. o que sobrou no localStorage migra pra conta e some do navegador", async ({ page }) => {
    const { memberId } = fixtures();
    await db.from("member_preferences").delete().eq("member_id", memberId); // nunca configurou na conta
    await loginAsTestDono(page);

    await page.goto("/tarefas");
    await page.evaluate(() => {
      window.localStorage.setItem("vizantu-tarefas:task-columns:v1", JSON.stringify(["status", "dueDate"]));
      window.localStorage.setItem("vizantu-tarefas:date-format:v1", "relativo");
    });
    await page.reload();

    await expect.poll(async () => {
      const { preferences } = await (await page.request.get("/api/preferences")).json();
      return preferences.dateFormat;
    }, { timeout: 10_000 }).toBe("relativo");

    const { preferences } = await (await page.request.get("/api/preferences")).json();
    expect(preferences.taskColumns).toEqual(["status", "dueDate"]);

    // E o navegador não guarda mais nada. O servidor grava antes de o cliente
    // receber a resposta e apagar as chaves, então isso é uma condição a
    // esperar, não um valor a conferir uma vez.
    await expect.poll(async () => page.evaluate(() => [
      window.localStorage.getItem("vizantu-tarefas:task-columns:v1"),
      window.localStorage.getItem("vizantu-tarefas:date-format:v1"),
    ]), { timeout: 10_000 }).toEqual([null, null]);
  });

  test("8. quem já configurou na conta não é sobrescrito pelo navegador velho", async ({ page }) => {
    await loginAsTestDono(page);
    await page.request.patch("/api/preferences", { data: { ...PADRAO, dateFormat: "curto" } });

    await page.goto("/tarefas");
    await page.evaluate(() => window.localStorage.setItem("vizantu-tarefas:date-format:v1", "relativo"));
    await page.reload();
    await page.waitForTimeout(1200);

    const { preferences } = await (await page.request.get("/api/preferences")).json();
    expect(preferences.dateFormat).toBe("curto"); // a conta manda
    // e a chave velha foi embora mesmo assim
    await expect.poll(async () => page.evaluate(() => window.localStorage.getItem("vizantu-tarefas:date-format:v1")), { timeout: 10_000 }).toBeNull();
  });
});
