import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { fixtures, loginAsTestDono } from "./helpers";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

test("texto e criativos são aprovados individualmente, com motivo e nova rodada", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loginAsTestDono(page);
  const { projectId } = fixtures();
  const planResponse = await page.request.post("/api/plans", { data: { projectId, title: `[E2E] Aprovação completa ${Date.now()}`, kind: "content" } });
  expect(planResponse.ok()).toBeTruthy();
  const { plan } = await planResponse.json();
  const taskIds: string[] = [];
  const names = ["Reels 1", "Reels 2", "Carrossel 1", "Carrossel 2"];
  for (const name of names) {
    const response = await page.request.post("/api/tasks", { data: { projectId, planId: plan.id, name, description: `### Roteiro\n**Texto de teste:** ${name}` } });
    expect(response.ok()).toBeTruthy();
    taskIds.push((await response.json()).task.id);
  }
  expect((await page.request.post(`/api/plans/${plan.id}/approval-round`, { data: { stage: "copy" } })).ok()).toBeTruthy();
  const { link } = await (await page.request.post(`/api/projects/${projectId}/link`)).json();
  await page.goto(`/c/${link.token}`);
  await expect(page).toHaveURL(/\/c\/dashboard$/);
  await page.getByPlaceholder("Como podemos te identificar?").fill("Cliente E2E");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();

  for (const taskId of taskIds.slice(0, 3)) {
    const response = await page.request.post("/api/c/approve", { data: { taskId, reviewerName: "Cliente E2E", status: "approved", reviewVersion: 1 } });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).taskStatus).toBe("pronto_para_criacao");
  }
  // O quarto texto continua pendente e não pode bloquear os outros criativos.
  const repeated = await page.request.post("/api/c/approve", { data: { taskId: taskIds[0], reviewerName: "Cliente E2E", status: "approved" } });
  expect(repeated.status()).toBe(409);

  // Status primeiro, link depois; o portal já aberto se atualiza sozinho.
  expect((await page.request.patch(`/api/tasks/${taskIds[0]}`, { data: { status: "para_aprovacao" } })).ok()).toBeTruthy();
  let items = (await (await page.request.get("/api/c/items")).json()).items;
  expect(items.find((item: { id: string }) => item.id === taskIds[0]).reviewVersion).toBe(1);
  await page.locator(".cd-sequence-item").filter({ hasText: names[0] }).click();
  await expect(page.getByRole("button", { name: "Aprovar criação", exact: true })).toBeHidden();
  expect((await page.request.patch(`/api/tasks/${taskIds[0]}`, { data: { driveLink: "https://example.com/creative-1" } })).ok()).toBeTruthy();
  await expect(page.getByRole("button", { name: "Aprovar criação", exact: true })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("link", { name: /Abrir material para revisar/ })).toHaveAttribute("href", "https://example.com/creative-1");
  const stale = await page.request.post("/api/c/approve", { data: { taskId: taskIds[0], reviewerName: "Cliente E2E", status: "approved", reviewVersion: 1 } });
  expect(stale.status()).toBe(409);
  const approved = page.waitForResponse((r) => r.url().endsWith("/api/c/approve") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Aprovar criação", exact: true }).click();
  expect((await (await approved).json()).taskStatus).toBe("aprovado");
  // Aprovar pode abrir o próximo item automaticamente.
  await page.waitForTimeout(750);
  if (await page.getByRole("button", { name: "Fechar", exact: true }).isVisible()) await page.getByRole("button", { name: "Fechar", exact: true }).click();

  // Link primeiro, status depois; sem ambos a criação continua bloqueada.
  expect((await page.request.patch(`/api/tasks/${taskIds[1]}`, { data: { driveLink: "https://example.com/creative-2" } })).ok()).toBeTruthy();
  items = (await (await page.request.get("/api/c/items")).json()).items;
  expect(items.find((item: { id: string }) => item.id === taskIds[1]).reviewVersion).toBe(1);
  for (const taskId of taskIds.slice(1)) {
    expect((await page.request.patch(`/api/tasks/${taskId}`, { data: { status: "para_aprovacao", driveLink: `https://example.com/${taskId}` } })).ok()).toBeTruthy();
  }
  // Repetir o salvamento não abre outra rodada.
  expect((await page.request.patch(`/api/tasks/${taskIds[1]}`, { data: { status: "para_aprovacao" } })).ok()).toBeTruthy();
  const { data: reopened } = await db.from("plan_approval_events").select("id").eq("task_id", taskIds[1]).eq("action", "reopened").eq("review_version", 100);
  expect(reopened).toHaveLength(1);
  await page.reload();
  const modal = page.locator(".cd-approval-modal");
  // Ajuste obrigatório na interface e na API.
  await page.locator(".cd-sequence-item").filter({ hasText: names[1] }).click();
  await page.getByRole("button", { name: "Pedir ajuste", exact: true }).click();
  await expect(page.getByRole("button", { name: "Enviar ajuste de criação" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Ajuste solicitado (obrigatório)" }).fill("Aumentar o contraste da legenda.");
  const adjusted = page.waitForResponse((r) => r.url().endsWith("/api/c/approve"));
  await page.getByRole("button", { name: "Enviar ajuste de criação" }).click();
  expect((await (await adjusted).json()).taskStatus).toBe("ajuste");
  await expect(modal).toBeHidden();

  await page.locator(".cd-sequence-item").filter({ hasText: names[2] }).click();
  await page.getByRole("button", { name: "Reprovar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirmar reprovação" })).toBeDisabled();
  for (const status of ["rejected", "changes_requested"]) {
    for (const comment of [undefined, "  ", { invalid: true }]) {
      expect((await page.request.post("/api/c/approve", { data: { taskId: taskIds[2], reviewerName: "Cliente E2E", status, comment, reviewVersion: 100 } })).status()).toBe(400);
    }
  }
  await page.getByRole("textbox", { name: "Motivo da reprovação (obrigatório)" }).fill("O visual não corresponde à campanha.");
  const rejected = page.waitForResponse((r) => r.url().endsWith("/api/c/approve"));
  await page.getByRole("button", { name: "Confirmar reprovação" }).click();
  expect((await (await rejected).json()).taskStatus).toBe("problema");
  await expect(modal).toBeHidden();

  // Link removido depois de enviar impede decisão até a equipe repor o material.
  expect((await page.request.patch(`/api/tasks/${taskIds[3]}`, { data: { driveLink: "" } })).ok()).toBeTruthy();
  expect((await page.request.post("/api/c/approve", { data: { taskId: taskIds[3], reviewerName: "Cliente E2E", status: "approved", reviewVersion: 100 } })).status()).toBe(409);
  expect((await page.request.patch(`/api/tasks/${taskIds[3]}`, { data: { driveLink: "https://example.com/creative-4" } })).ok()).toBeTruthy();
  expect((await page.request.post("/api/c/approve", { data: { taskId: taskIds[3], reviewerName: "Cliente E2E", status: "approved", reviewVersion: 100 } })).ok()).toBeTruthy();

  const { data: tasks } = await db.from("tasks").select("id,status,comments").in("id", taskIds);
  expect(tasks?.map((task) => task.status).sort()).toEqual(["ajuste", "aprovado", "aprovado", "problema"].sort());
  expect(JSON.stringify(tasks?.find((task) => task.id === taskIds[2])?.comments)).toContain("O visual não corresponde à campanha.");
  expect((await page.request.patch(`/api/tasks/${taskIds[1]}`, { data: { status: "para_aprovacao" } })).ok()).toBeTruthy();
  const newDecision = await page.request.post("/api/c/approve", { data: { taskId: taskIds[1], reviewerName: "Cliente E2E", status: "approved", reviewVersion: 101 } });
  expect(newDecision.ok()).toBeTruthy();
  const { data: history } = await db.from("plan_approval_responses").select("status, review_version").eq("task_id", taskIds[1]).order("review_version");
  expect(history?.map((r) => [r.review_version, r.status])).toEqual([[1, "approved"], [100, "changes_requested"], [101, "approved"]]);
  expect(errors).toEqual([]);
});

test("recupera criativos antigos, cria novos prontos e preserva o isolamento do cliente", async ({ page, request }) => {
  test.setTimeout(90_000);
  await loginAsTestDono(page);
  const { projectId } = fixtures();
  const { plan } = await (await page.request.post("/api/plans", { data: { projectId, title: "[E2E] Legado", kind: "content" } })).json();
  const { task } = await (await page.request.post("/api/tasks", { data: { projectId, planId: plan.id, name: "Criativo legado", description: "Texto", status: "para_aprovacao", driveLink: "https://example.com/legacy" } })).json();
  const { data: initial } = await db.from("plan_item_approvals").select("status,review_version").eq("task_id", task.id).single();
  expect(initial).toEqual({ status: "pending", review_version: 100 });
  // Simula registro de antes da correção, sem etapa de criação.
  expect((await db.from("plan_item_approvals").delete().eq("task_id", task.id)).error).toBeNull();
  const { link } = await (await page.request.post(`/api/projects/${projectId}/link`)).json();
  await page.goto(`/c/${link.token}`);
  const responses = await Promise.all([page.request.get("/api/c/items"), page.request.get("/api/c/items")]);
  for (const response of responses) {
    const item = (await response.json()).items.find((item: { id: string }) => item.id === task.id);
    expect(item.reviewVersion).toBe(100);
    expect(item.approvalStatus).toBe("pending");
  }
  expect((await request.get("/api/c/items")).status()).toBe(401);
  const foreign = await db.from("projects").insert({ name: "[E2E] Isolamento de aprovação", client: "E2E", status: "ativo" }).select("id").single();
  expect(foreign.error).toBeNull();
  try {
    const { task: foreignTask } = await (await page.request.post("/api/tasks", { data: { projectId: foreign.data!.id, name: "Conteúdo de outro cliente" } })).json();
    const response = await page.request.post("/api/c/approve", { data: { taskId: foreignTask.id, reviewerName: "Cliente E2E", status: "approved" } });
    expect(response.status()).toBe(404);
    expect((await page.request.post("/api/c/approve", { data: { taskId: task.id, reviewerName: "Cliente E2E", status: "approved", reviewVersion: 100 } })).ok()).toBeTruthy();
  } finally {
    await db.from("projects").delete().eq("id", foreign.data!.id);
  }
});
