import { expect, test } from "@playwright/test";
import { fixtures, loginAsTestDono, loginAsTestViewer } from "./helpers";

test.describe("criação de Plano", () => {
  test("1. plano de conteúdo: captação + item guardam plan_id e captacao_id", async ({ page }) => {
    await loginAsTestDono(page);
    const { projectId } = fixtures();
    const plan = await (await page.request.post("/api/plans", { data: { projectId, title: "[E2E] Plano de conteúdo", kind: "content" } })).json();
    expect(plan.plan.kind).toBe("content");

    const captacao = await (
      await page.request.post("/api/plan-captacoes", { data: { planId: plan.plan.id, label: "1ª Captação", sequenceOrder: 0 } })
    ).json();
    expect(captacao.captacao.label).toBe("1ª Captação");

    const item = await (
      await page.request.post("/api/tasks", { data: { projectId, planId: plan.plan.id, captacaoId: captacao.captacao.id, name: "Vídeo #1" } })
    ).json();
    expect(item.task.planId).toBe(plan.plan.id);
    expect(item.task.captacaoId).toBe(captacao.captacao.id);
  });

  test("2. plano de processo: passos guardam sequenceOrder e sem campos de conteúdo", async ({ page }) => {
    await loginAsTestDono(page);
    const { projectId } = fixtures();
    const plan = await (await page.request.post("/api/plans", { data: { projectId, title: "[E2E] Onboarding Ads", kind: "process" } })).json();
    const step1 = await (
      await page.request.post("/api/tasks", { data: { projectId, planId: plan.plan.id, name: "E-mail de acesso enviado", sequenceOrder: 0 } })
    ).json();
    const step2 = await (
      await page.request.post("/api/tasks", { data: { projectId, planId: plan.plan.id, name: "Confirmação de acesso", sequenceOrder: 1 } })
    ).json();
    expect(step1.task.sequenceOrder).toBe(0);
    expect(step2.task.sequenceOrder).toBe(1);
    expect(step1.task.scriptText).toBeUndefined();
  });

  test("3. roteiro/direcionamento/referência/legenda fazem round-trip completo", async ({ page }) => {
    await loginAsTestDono(page);
    const { projectId } = fixtures();
    const plan = await (await page.request.post("/api/plans", { data: { projectId, title: "[E2E] Roteiro round-trip", kind: "content" } })).json();
    const created = await (
      await page.request.post("/api/tasks", { data: { projectId, planId: plan.plan.id, name: "Vídeo roteiro" } })
    ).json();
    const patched = await (
      await page.request.patch(`/api/tasks/${created.task.id}`, {
        data: { scriptText: "Roteiro de teste", directionText: "Direcionamento de teste", referenceText: "https://ref.example", captionText: "Legenda de teste" },
      })
    ).json();
    expect(patched.task.scriptText).toBe("Roteiro de teste");
    expect(patched.task.directionText).toBe("Direcionamento de teste");
    expect(patched.task.referenceText).toBe("https://ref.example");
    expect(patched.task.captionText).toBe("Legenda de teste");
  });

  test("4. visualizador não pode criar plano", async ({ page }) => {
    await loginAsTestViewer(page);
    const { projectId } = fixtures();
    const response = await page.request.post("/api/plans", { data: { projectId, title: "Não deveria criar", kind: "content" } });
    expect(response.status()).toBe(403);
  });

  test("5. tela /planos carrega e lista o plano criado", async ({ page }) => {
    await loginAsTestDono(page);
    const { projectId } = fixtures();
    await page.request.post("/api/plans", { data: { projectId, title: "[E2E] Visível na lista", kind: "content" } });
    await page.goto("/planos");
    await expect(page.getByText("[E2E] Visível na lista")).toBeVisible();
  });
});
