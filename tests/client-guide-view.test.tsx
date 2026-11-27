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

  it("mostra só o que foi respondido e oferece a edição manual", () => {
    render({ desejo: "Lotar a agenda do consultório", quemEh: "Pediatra há vinte anos" });
    expect(perguntas()).toEqual(["Quem é o cliente?", "Qual é o desejo dele?"]);
    expect(botao("Editar informações")).toBeTruthy();
    expect(botao("Atualizar com a IA")).toBeTruthy();
  });

  it("Editar informações abre todos os campos e as reuniões, e volta para a leitura", () => {
    render({ desejo: "Lotar a agenda do consultório" });
    act(() => botao("Editar informações")!.click());
    expect(perguntas()).toHaveLength(24);
    expect(container.querySelectorAll(".guia-campo input, .guia-campo textarea, .guia-campo select")).toHaveLength(24);
    expect(container.textContent).toContain("Reuniões e anotações");
    act(() => botao("Concluir edição")!.click());
    expect(perguntas()).toEqual(["Qual é o desejo dele?"]);
  });

  it("quem só lê não vê botão de IA nem de editar", () => {
    render({ desejo: "Lotar a agenda" }, { canEdit: false });
    expect(botao("com a IA")).toBeUndefined();
    expect(botao("Editar informações")).toBeUndefined();
  });

  it("sem IA continua dando para editar à mão", () => {
    render({}, { aiEnabled: false });
    act(() => botao("Editar informações")!.click());
    expect(container.querySelectorAll(".guia-campo textarea").length).toBeGreaterThan(0);
  });

  it("preencher um campo logo depois do outro salva os dois", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ profile: {} })));
    render({});
    act(() => botao("Editar informações")!.click());
    const [primeiro, segundo] = [...container.querySelectorAll<HTMLTextAreaElement>(".guia-campo textarea")];
    const digitar = (campo: HTMLTextAreaElement, valor: string) => act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(campo, valor);
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    digitar(primeiro, "primeira resposta");
    digitar(segundo, "segunda resposta");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const enviados = fetchMock.mock.calls.map(([, init]) => Object.values(JSON.parse(init.body))[0]);
    expect(enviados).toEqual(["primeira resposta", "segunda resposta"]);
    vi.useRealTimers();
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
