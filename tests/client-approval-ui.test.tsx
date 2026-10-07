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


describe("pacotes no painel do cliente", () => {
  it("separa pacotes, mostra a ordem de publicação e abre o conteúdo correto", async () => {
    const items: DashboardItem[] = [
      { ...creative, id: "late", name: "Vídeo posterior", dueDate: "2026-10-20", clientPackageId: "c2", clientPackageLabel: "2ª Captação", clientPackageKind: "capture", clientPackageOrder: 1 },
      { ...creative, id: "early", name: "Vídeo inicial", dueDate: "2026-10-05", clientPackageId: "c1", clientPackageLabel: "1ª Captação", clientPackageKind: "capture", clientPackageOrder: 0 },
      { ...creative, id: "middle", name: "Vídeo seguinte", dueDate: "2026-10-08", clientPackageId: "c1", clientPackageLabel: "1ª Captação", clientPackageKind: "capture", clientPackageOrder: 0 },
    ];
    await act(async () => root.render(<ClientDashboard clientName="Cliente" roleTitle={null} city={null} instagramHandle={null} initialItems={items} events={[]} initialScore={null} />));
    const groups = container.querySelectorAll(".cd-package-list .cd-group");
    expect(groups).toHaveLength(2);
    expect(groups[0].querySelector("h3")?.textContent).toBe("1ª Captação");
    expect([...groups[0].querySelectorAll(".cd-group-item-name")].map((node) => node.textContent)).toEqual(["Vídeo inicial", "Vídeo seguinte"]);
    expect(groups[1].querySelector("h3")?.textContent).toBe("2ª Captação");
    await click(groups[1].querySelector(".cd-sequence-item"));
    expect(container.querySelector(".cd-modal")?.textContent || container.textContent).toContain("Vídeo posterior");
  });
});

describe("histórico de ajustes no portal", () => {
  const pedido = { id: "e1", stage: "copy" as const, round: 1, action: "changes_requested" as const, reviewerName: "Richard", comment: "Trocar Boteco por Buteco", at: "2026-10-03T04:47:17.000Z" };
  const texto: DashboardItem = { ...creative, id: "texto-1", name: "Convite para o Buteco", materialLink: null, reviewVersion: 1, description: "Convite para o Buteco" };

  // O ajuste era simples e o conteúdo seguiu direto para a criação: o cliente
  // precisa ver que pediu, que foi feito e o que mudou.
  it("mostra o pedido, que foi aplicado e o que mudou no texto", async () => {
    await mount({
      ...texto, status: "pronto_para_criacao", approvalStatus: "changes_requested",
      history: [{ ...pedido, outcome: "applied", resolvedAt: "2026-10-05T15:01:42.000Z", textBefore: "Convite para o Boteco", textAfter: "Convite para o Buteco" }],
    });
    expect(container.querySelector(".cd-sequence-stage .cd-pill")?.textContent).toBe("Texto: ajuste aplicado");
    const history = container.querySelector(".cd-history")!;
    expect(history.textContent).toContain("Richard pediu ajuste no texto");
    expect(history.querySelector("blockquote")?.textContent).toBe("Trocar Boteco por Buteco");
    expect(history.textContent).toContain("Ajuste aplicado pela equipe em 05 de out");
    expect(history.querySelector(".cd-history__diff del")?.textContent).toBe("Boteco");
    expect(history.querySelector(".cd-history__diff ins")?.textContent).toBe("Buteco");
    expect(container.querySelector(".cd-decision-closed")?.textContent).toContain("Ajuste aplicado");
  });

  it("avisa que é uma nova versão quando o texto volta para aprovar", async () => {
    await mount({ ...texto, status: "aprovacao_copy", approvalStatus: "pending", reviewVersion: 2, history: [{ ...pedido, outcome: "resent", resolvedAt: "2026-10-05T15:01:42.000Z" }] });
    expect(container.querySelector(".cd-sequence-stage .cd-pill")?.textContent).toBe("Texto: nova versão para revisar");
    expect(container.querySelector(".cd-history")?.textContent).toContain("Enviamos uma nova versão para você revisar");
    expect(button("Aprovar texto")).toBeTruthy();
  });

  it("não mostra histórico em conteúdo que nunca teve pedido", async () => {
    await mount(texto);
    expect(container.querySelector(".cd-history")).toBeNull();
  });
});

describe("seções do conteúdo no portal", () => {
  const comSecoes: DashboardItem = {
    ...creative, id: "secoes-1", name: "Conteúdo com seções", status: "aprovacao_copy", materialLink: null, reviewVersion: 1,
    description: "**Direcionamento**\nMostrar por que o Buteco é diferente.\n\n**Roteiro**\nCena 1: abre no palco.\n\n**Legenda**\nVem pro Buteco!",
  };
  const cartao = (nome: string) => Array.from(container.querySelectorAll(".cd-section-card")).find((card) => card.querySelector("strong")?.textContent === nome);
  const ativo = () => container.querySelector(".cd-section-card.is-active strong")?.textContent;

  // A ideia vem antes do texto: o cliente lê o direcionamento e só então
  // encontra a aprovação, na seção do conteúdo.
  it("começa no direcionamento e leva a aprovação para o conteúdo", async () => {
    await mount(comSecoes);
    expect(ativo()).toBe("Direcionamento");
    expect(container.querySelector(".cd-item-description")?.textContent).toContain("Mostrar por que o Buteco é diferente.");
    expect(container.querySelector(".cd-item-description")?.textContent).not.toContain("Vem pro Buteco!");
    expect(button("Aprovar texto")).toBeUndefined();

    await click(container.querySelector(".cd-next-section"));
    expect(ativo()).toBe("Conteúdo");
    expect(container.querySelector(".cd-item-description")?.textContent).toContain("Vem pro Buteco!");
    expect(button("Aprovar texto")).toBeTruthy();
    // "Essa eu já fiz, agora falta essa."
    expect(cartao("Direcionamento")?.querySelector(".cd-pill")?.textContent).toBe("Lido");
    expect(cartao("Conteúdo")?.querySelector(".cd-pill")?.textContent).toBe("Para revisar");
    expect(cartao("Criativo")?.querySelector(".cd-pill")?.textContent).toBe("Depois do texto");
    expect(cartao("Publicado")?.querySelector(".cd-pill")?.textContent).toBe("Ainda não");
  });

  it("abre direto no criativo quando é ele que espera resposta", async () => {
    await mount({ ...comSecoes, status: "para_aprovacao", reviewVersion: 100, materialLink: "https://drive.google.com/drive/folders/abc" });
    expect(ativo()).toBe("Criativo");
    expect(cartao("Conteúdo")?.querySelector(".cd-pill")?.textContent).toBe("Aprovado");
    expect(container.querySelector(".cd-material-link")?.getAttribute("href")).toBe("https://drive.google.com/drive/folders/abc");
    expect(button("Aprovar criação")).toBeTruthy();
  });

  // Conteúdo finalizado sem a resposta do cliente no portal: não pode
  // aparecer como "em preparo", nem prometer um material que já saiu.
  it("mostra como concluído o criativo que a equipe finalizou sem resposta", async () => {
    await mount({ ...comSecoes, status: "finalizado", reviewVersion: 100, approvalStatus: "pending", materialLink: "https://drive.google.com/drive/folders/abc" });
    expect(cartao("Criativo")?.querySelector(".cd-pill")?.textContent).toBe("Concluído");
    expect(cartao("Publicado")?.querySelector(".cd-pill")?.textContent).toBe("Publicado");
    expect(container.textContent).toContain("Este conteúdo já foi concluído pela equipe.");
    expect(container.textContent).not.toContain("A criação será liberada");
    expect(button("Aprovar criação")).toBeUndefined();
  });

  it("mostra como liberado o texto com que a equipe seguiu sem resposta", async () => {
    await mount({ ...comSecoes, status: "em_criacao", reviewVersion: 1, approvalStatus: "pending" });
    expect(cartao("Conteúdo")?.querySelector(".cd-pill")?.textContent).toBe("Liberado");
    await click(cartao("Conteúdo"));
    expect(container.textContent).toContain("A equipe seguiu com este conteúdo.");
    expect(button("Aprovar texto")).toBeUndefined();
  });

  it("marca como publicado o conteúdo finalizado", async () => {
    await mount({ ...comSecoes, status: "finalizado", reviewVersion: 100, approvalStatus: "approved", materialLink: "https://drive.google.com/drive/folders/abc" });
    expect(cartao("Publicado")?.querySelector(".cd-pill")?.textContent).toBe("Publicado");
  });
});
