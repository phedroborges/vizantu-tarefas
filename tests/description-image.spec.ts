import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { fixtures, loginAsTestDono } from "./helpers";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// PNG 1x1 válido — pequeno o bastante pra viajar no clipboard/DataTransfer
// sintético sem depender de arquivo em disco.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("imagem colada entra dentro da descrição, no ponto do cursor", async ({ page }) => {
  const { projectId } = fixtures();
  await loginAsTestDono(page);

  const created = await page.request.post("/api/tasks", {
    data: { projectId, name: `E2E imagem inline ${Date.now()}`, description: "Cena 1\nCena 2" },
  });
  expect(created.ok()).toBeTruthy();
  const { task } = await created.json();

  try {
    await page.goto(`/tarefas/${task.id}`);

    // Entra em edição e põe o cursor no fim da primeira linha.
    const field = page.locator(".task-desc-textarea").first();
    await field.click();
    const textarea = page.locator("textarea.task-desc-textarea");
    await expect(textarea).toBeVisible();
    await textarea.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 6));

    const uploaded = page.waitForResponse((r) => r.url().includes("/api/uploads") && r.request().method() === "POST");
    await textarea.evaluate(async (el, base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const file = new File([bytes], "ref.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    }, PNG_BASE64);
    const uploadResponse = await uploaded;
    expect(uploadResponse.ok()).toBeTruthy();

    // O markdown da imagem ficou ENTRE as duas cenas, não no topo nem no fim.
    await expect
      .poll(async () => textarea.inputValue(), { timeout: 10_000 })
      .toMatch(/^Cena 1\n!\[\]\(https?:\/\/\S+\)\nCena 2$/);

    // O autosave gravou o mesmo texto no banco — é isso que a IA e o painel
    // do cliente vão ler depois.
    await expect.poll(async () => {
      const { data } = await db.from("tasks").select("description").eq("id", task.id).maybeSingle();
      return data?.description || "";
    }, { timeout: 10_000 }).toMatch(/^Cena 1\n!\[\]\(https?:\/\/\S+\)\nCena 2$/);

    // E, recarregando, a imagem aparece renderizada ENTRE as duas cenas.
    await page.reload();
    const image = page.locator(".markdown-lite-image img");
    await expect(image).toBeVisible();
    const ordem = await page.locator(".task-desc-textarea").first().innerText();
    expect(ordem.indexOf("Cena 1")).toBeLessThan(ordem.indexOf("Cena 2"));
  } finally {
    await page.request.delete(`/api/tasks/${task.id}`);
  }
});
