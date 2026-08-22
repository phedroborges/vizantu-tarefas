import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { fixtures, loginAsTestDono } from "./helpers";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

test("fluxo completo: texto, produção, criativo e nova rodada", async ({ page }) => {
  await loginAsTestDono(page);
  const { projectId } = fixtures();
  const planResponse = await page.request.post("/api/plans", { data: { projectId, title: `[E2E] Aprovação completa ${Date.now()}`, kind: "content" } });
  expect(planResponse.ok()).toBeTruthy();
  const { plan } = await planResponse.json();

  const taskIds: string[] = [];
  for (const name of ["Reels 1", "Reels 2", "Carrossel 1", "Carrossel 2"]) {
    const response = await page.request.post("/api/tasks", { data: { projectId, planId: plan.id, name, description: `### Roteiro\n**Texto de teste:** ${name}` } });
    expect(response.ok()).toBeTruthy();
    const { task } = await response.json();
    expect(task.status).toBe("rascunho");
    taskIds.push(task.id);
  }

  const copyRound = await page.request.post(`/api/plans/${plan.id}/approval-round`, { data: { stage: "copy" } });
  expect(copyRound.ok()).toBeTruthy();
  expect((await copyRound.json()).opened).toBe(4);

  const linkResponse = await page.request.post(`/api/projects/${projectId}/link`);
  const { link } = await linkResponse.json();
  await page.goto(`/c/${link.token}`);
  await expect(page).toHaveURL(/\/c\/dashboard$/);

  for (const taskId of taskIds) {
    const approval = await page.request.post("/api/c/approve", { data: { taskId, reviewerName: "Cliente E2E", status: "approved" } });
    expect(approval.ok()).toBeTruthy();
    expect((await approval.json()).taskStatus).toBe("pronto_para_criacao");
  }

  const repeatedDecision = await page.request.post("/api/c/approve", { data: { taskId: taskIds[0], reviewerName: "Cliente E2E", status: "rejected", comment: "troca indevida" } });
  expect(repeatedDecision.status()).toBe(409);

  for (const taskId of taskIds) {
    const response = await page.request.patch(`/api/tasks/${taskId}`, { data: { status: "pronto_para_criacao", driveLink: `https://drive.google.com/file/d/${taskId}/view` } });
    expect(response.ok()).toBeTruthy();
  }

  const creativeRound = await page.request.post(`/api/plans/${plan.id}/approval-round`, { data: { stage: "creative" } });
  expect(creativeRound.ok()).toBeTruthy();
  expect((await creativeRound.json()).opened).toBe(4);

  const creativeDecisions = ["approved", "approved", "changes_requested", "rejected"] as const;
  for (const [index, taskId] of taskIds.entries()) {
    const status = creativeDecisions[index];
    const response = await page.request.post("/api/c/approve", { data: { taskId, reviewerName: "Cliente E2E", status, comment: status === "approved" ? undefined : `Retorno ${status}` } });
    expect(response.ok()).toBeTruthy();
  }

  const { data: tasks } = await db.from("tasks").select("id,status").in("id", taskIds);
  expect(tasks?.map((task) => task.status).sort()).toEqual(["ajuste", "aprovado", "aprovado", "problema"].sort());
  const { data: approvals } = await db.from("plan_item_approvals").select("status,review_version").in("task_id", taskIds);
  expect(approvals?.every((approval) => approval.review_version === 100 && approval.status !== "pending")).toBeTruthy();
});
