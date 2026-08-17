import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { FIXTURE_PATH, TEST_EMAIL, TEST_PASSWORD, TEST_VIEWER_EMAIL } from "./global-setup";

export function fixtures(): { memberId: string; viewerId: string; projectId: string } {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(TEST_PASSWORD);
  // AnnouncementGate busca os avisos pendentes assim que o AdminShell monta —
  // espera essa resposta em vez de confiar só na navegação, senão o teste
  // pode checar visibilidade antes do fetch (ou da compilação da rota em dev)
  // terminar.
  const pendingFetch = page.waitForResponse((r) => r.url().includes("/api/announcements?pending=1"));
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await pendingFetch;
}

export async function loginAsTestDono(page: Page) {
  await login(page, TEST_EMAIL);
}

export async function loginAsTestViewer(page: Page) {
  await login(page, TEST_VIEWER_EMAIL);
}

// Mesmo motivo do wait dentro de login(): sem isso, um `toBeHidden()` logo
// após reload() pode passar "de graça" só porque o fetch ainda não voltou,
// não porque o aviso de fato foi confirmado.
export async function reloadAndWaitForAnnouncements(page: Page) {
  const pendingFetch = page.waitForResponse((r) => r.url().includes("/api/announcements?pending=1"));
  await page.reload();
  await pendingFetch;
}
