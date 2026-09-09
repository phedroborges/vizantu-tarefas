// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientDashboard, type DashboardItem } from "../src/components/client-dashboard";

vi.mock("../src/lib/confetti", () => ({ burst: vi.fn() }));
const creative: DashboardItem = {
  id: "creative-1", name: "Criativo de teste", status: "para_aprovacao", materialLink: "https://example.com/creative",
  approvalStatus: "pending", reviewVersion: 100, updatedAt: "2026-09-08T12:00:00Z", dueDate: null,
  captacaoLabel: null, formatLabel: "Carrossel", channelLabel: null, categoryLabel: null, reference: null, description: "Texto do conteúdo",
};
let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();
function button(name: string) {
  return Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === name);
}
async function click(element: Element | undefined | null) {
  expect(element).toBeTruthy();
  await act(async () => (element as HTMLElement).click());
}
async function mount(item = creative) {
  await act(async () => root.render(<ClientDashboard clientName="Cliente" roleTitle={null} city={null} instagramHandle={null} initialItems={[item]} events={[]} initialScore={null} />));
  await click(container.querySelector(".cd-sequence-item"));
}
async function typeReason(value: string) {
  const input = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  localStorage.setItem("vizantu-client-reviewer-name", "Maria");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("aprovação de criativo no portal", () => {
  it("libera a fase 2 com o material e envia a versão revisada", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "approved", reviewVersion: 100, taskStatus: "aprovado" }) });
    await mount();
    expect(container.querySelector(".cd-material-link")?.getAttribute("href")).toBe(creative.materialLink);
    await click(button("Aprovar criação"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ taskId: creative.id, reviewerName: "Maria", status: "approved", comment: "", reviewVersion: 100 });
    expect(container.querySelector(".cd-decision-closed")?.textContent).toContain("Aprovado");
  });

  it.each([{ ...creative, materialLink: null }, { ...creative, status: "em_criacao" }])("bloqueia uma criação sem as duas condições", async (item) => {
    await mount(item);
    expect(button("Aprovar criação")).toBeUndefined();
    expect(container.textContent).toContain("A criação será liberada");
  });

  it.each([
    ["Reprovar", "Confirmar reprovação", "rejected", "problema"],
    ["Pedir ajuste", "Enviar ajuste de criação", "changes_requested", "ajuste"],
  ])("exige motivo para %s", async (action, confirmation, status, taskStatus) => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status, reviewVersion: 100, taskStatus }) });
    await mount();
    await click(button(action));
    expect(button(confirmation)?.disabled).toBe(true);
    await typeReason("Trocar a imagem da campanha.");
    expect(button(confirmation)?.disabled).toBe(false);
    await click(button(confirmation));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ status, comment: "Trocar a imagem da campanha.", reviewVersion: 100 });
  });

  it("mostra a falha da API e mantém a decisão disponível para tentar novamente", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Este conteúdo mudou de rodada." }) });
    await mount();
    await click(button("Aprovar criação"));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Este conteúdo mudou de rodada.");
    expect(button("Aprovar criação")?.disabled).toBe(false);
  });

  it("atualiza o portal aberto quando a criação é liberada", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [creative] }) });
    await mount({ ...creative, approvalStatus: "approved", reviewVersion: 1, status: "pronto_para_criacao", materialLink: null });
    expect(button("Aprovar criação")).toBeUndefined();
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(button("Aprovar criação")?.disabled).toBe(false);
  });
});
