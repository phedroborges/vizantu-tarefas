import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { fixtures, loginAsTestDono } from "./helpers";

// O painel do cliente vive NESTE app (/c/[token]) e é público — mas isso não
// pode abrir buraco no gate de autenticação do time. Estes testes travam as
// duas metades: o cliente entra sem login; o resto do app continua exigindo.
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function createLink(projectId: string, patch: Record<string, unknown> = {}) {
  const token = `e2e-link-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.from("client_links").insert({ project_id: projectId, token, ...patch });
  return token;
}

test.describe("Link do cliente (dentro do vizantu-tarefas)", () => {
  test("1. token válido leva ao painel, sem login", async ({ page }) => {
    const { projectId } = fixtures();
    await db.from("projects").update({ client: "Cliente E2E", client_role: "Médica", client_city: "Mineiros - GO" }).eq("id", projectId);
    const token = await createLink(projectId);
    await page.goto(`/c/${token}`);
    await expect(page).toHaveURL(/\/c\/dashboard$/);
    await expect(page.getByText("Cliente E2E")).toBeVisible();
  });

  test("2. token inexistente cai na tela de link inválido", async ({ page }) => {
    await page.goto("/c/nao-existe-esse-token");
    await expect(page).toHaveURL(/\/c\/invalido/);
  });

  test("3. token revogado é rejeitado", async ({ page }) => {
    const { projectId } = fixtures();
    const token = await createLink(projectId, { revoked_at: new Date().toISOString() });
    await page.goto(`/c/${token}`);
    await expect(page).toHaveURL(/\/c\/invalido/);
  });

  test("4. painel sem cookie de sessão é barrado", async ({ page }) => {
    await page.goto("/c/dashboard");
    await expect(page).toHaveURL(/\/c\/invalido/);
  });

  test("5. sessão do cliente NÃO dá acesso ao app interno", async ({ page }) => {
    const { projectId } = fixtures();
    const token = await createLink(projectId);
    await page.goto(`/c/${token}`);
    await expect(page).toHaveURL(/\/c\/dashboard$/);
    // Mesmo navegador, com o cookie do cliente ativo: /tarefas continua
    // mandando pro login. O cliente não vira usuário do time.
    await page.goto("/tarefas");
    await expect(page).toHaveURL(/\/login/);
  });
});

test("6. o time gera o link do cliente na tela de Projetos", async ({ page }) => {
  const { projectId } = fixtures();
  await loginAsTestDono(page);
  const response = await page.request.post(`/api/projects/${projectId}/link`);
  expect(response.ok()).toBeTruthy();
  const { link } = await response.json();
  expect(link.token).toBeTruthy();
  expect(link.projectId).toBe(projectId);
});
