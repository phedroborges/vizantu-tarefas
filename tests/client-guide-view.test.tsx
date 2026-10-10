// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientGuideView } from "../src/components/client-guide-view";
import type { ProjectProfile } from "../src/lib/types";

// A aba abria com as dezoito perguntas em branco e o botão da IA apagado até
// alguém colar uma reunião. Quem ia estudar o cliente via um formulário vazio.

const fetchMock = vi.fn();
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

function render(profile: Partial<ProjectProfile>, props: { canEdit?: boolean; aiEnabled?: boolean } = {}) {
  act(() => root.render(<ClientGuideView projectId="p1" initialProfile={profile} initialSources={[]} canEdit={props.canEdit ?? true} aiEnabled={props.aiEnabled ?? true} cadastro={null} resumo={(guia) => <p data-testid="resumo">{guia.desejo}</p>} />));
}
const perguntas = () => [...container.querySelectorAll(".guia-campo__pergunta strong")].map((item) => item.textContent);
const botao = (texto: string) => [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(texto)) as HTMLButtonElement | undefined;

describe("guia do cliente em modo leitura", () => {
  it("sem nenhuma resposta não mostra pergunta em branco, e a IA já está liberada", () => {
    render({});
    expect(perguntas()).toEqual([]);
    expect(container.textContent).toContain("O guia deste cliente ainda não foi escrito");
    expect(container.textContent).not.toContain("Reuniões e anotações");
    expect(botao("Montar guia com a IA")?.disabled).toBe(false);
  });

  it("mostra só o que foi respondido e diz quanto falta", () => {
    render({ desejo: "Lotar a agenda do consultório", quemEh: "Pediatra há vinte anos" });
    expect(perguntas()).toEqual(["Quem é o cliente?", "Qual é o desejo dele?"]);
    expect(botao("Completar guia")?.textContent).toContain("faltam 16 respostas");
    expect(botao("Atualizar com a IA")).toBeTruthy();
  });

  it("Completar guia abre todas as perguntas e as reuniões, e volta para a leitura", () => {
    render({ desejo: "Lotar a agenda do consultório" });
    act(() => botao("Completar guia")!.click());
    expect(perguntas()).toHaveLength(18);
    expect(container.textContent).toContain("Reuniões e anotações");
    act(() => botao("Voltar para a leitura")!.click());
    expect(perguntas()).toEqual(["Qual é o desejo dele?"]);
  });

  it("quem só lê não vê botão de IA nem de completar", () => {
    render({ desejo: "Lotar a agenda" }, { canEdit: false });
    expect(botao("com a IA")).toBeUndefined();
    expect(botao("Completar guia")).toBeUndefined();
  });

  it("o que a IA devolve aparece no guia e no resumo", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ profile: { desejo: "Ser referência em pediatria", guideGeneratedAt: "2026-10-10T12:00:00.000Z" }, camposPreenchidos: ["desejo"], fontesLidas: 3, blocosComErro: [] })));
    render({});
    await act(async () => { botao("Montar guia com a IA")!.click(); });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1/guide", { method: "POST" });
    expect(perguntas()).toEqual(["Qual é o desejo dele?"]);
    expect(container.querySelector("[data-testid=resumo]")?.textContent).toBe("Ser referência em pediatria");
    expect(container.textContent).toContain("A IA leu 3 fontes");
  });
});
