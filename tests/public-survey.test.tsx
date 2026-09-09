// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicSurvey } from "../src/components/public-survey";
import type { Survey, SurveyQuestion } from "../src/lib/types";

// O formulário existe para ser respondido inteiro, sem reunião. As três coisas
// testadas aqui são exatamente as que decidem se alguém termina: ver um bloco
// por vez, não conseguir pular pergunta obrigatória, e poder fechar a aba no
// meio sem perder o que escreveu.

const NOW = "2026-09-09T12:00:00.000Z";
const q = (id: string, title: string, section: string, required = true): SurveyQuestion =>
  ({ id, title, type: "long_text", required, section });

const survey: Survey = {
  id: "s1", projectId: "p1", title: "Diagnóstico de marca", description: "",
  status: "published", token: "tok123", responses: [], createdAt: NOW, updatedAt: NOW,
  questions: [
    q("a1", "Quem fundou a empresa?", "Quem é a empresa"),
    q("a2", "Que problema fez ela existir?", "Quem é a empresa"),
    q("b1", "O que vocês vendem?", "O que vocês vendem"),
    q("b2", "Algo opcional", "O que vocês vendem", false),
  ],
};

let container: HTMLDivElement;
let root: Root;

const texto = () => container.textContent || "";
const campos = () => [...container.querySelectorAll("textarea")];
const botao = (rotulo: string) => [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(rotulo))!;

function digitar(campo: HTMLTextAreaElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setter.call(campo, valor);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("scrollTo", vi.fn());
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<PublicSurvey survey={survey} projectName="Tawper" />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("formulário público em blocos", () => {
  it("mostra um bloco por vez, não os quarenta campos de uma vez", () => {
    expect(texto()).toContain("Quem é a empresa");
    expect(texto()).toContain("Bloco 1 de 2");
    expect(campos()).toHaveLength(2);
    expect(texto()).not.toContain("O que vocês vendem?");
  });

  it("não deixa avançar deixando pergunta obrigatória para trás", () => {
    act(() => botao("Continuar").click());
    expect(texto()).toContain("Esta pergunta é obrigatória.");
    expect(texto()).toContain("Bloco 1 de 2");
  });

  it("avança quando o bloco está respondido e volta sem perder nada", () => {
    digitar(campos()[0], "O Paulo, em 1998.");
    digitar(campos()[1], "Faltava conexão hidráulica de reposição na região.");
    act(() => botao("Continuar").click());
    expect(texto()).toContain("Bloco 2 de 2");
    expect(texto()).toContain("O que vocês vendem?");

    act(() => botao("Voltar").click());
    expect(campos()[0].value).toBe("O Paulo, em 1998.");
  });

  it("o último bloco troca Continuar por Enviar", () => {
    digitar(campos()[0], "x");
    digitar(campos()[1], "y");
    act(() => botao("Continuar").click());
    expect(botao("Enviar respostas")).toBeTruthy();
  });

  // O caso que faz um diagnóstico longo ser respondido: parar no meio,
  // consultar outra pessoa da empresa e voltar no dia seguinte.
  it("guarda o rascunho e retoma de onde parou", () => {
    digitar(campos()[0], "Resposta longa que ninguém quer digitar duas vezes.");
    act(() => root.unmount());

    const novoContainer = document.createElement("div");
    document.body.append(novoContainer);
    const novoRoot = createRoot(novoContainer);
    act(() => novoRoot.render(<PublicSurvey survey={survey} projectName="Tawper" />));

    expect(novoContainer.textContent).toContain("Retomamos de onde você parou");
    expect([...novoContainer.querySelectorAll("textarea")][0].value).toBe("Resposta longa que ninguém quer digitar duas vezes.");
    act(() => novoRoot.unmount());
    novoContainer.remove();
    root = createRoot(container);
  });

  it("o rascunho é por formulário, não vaza de um cliente para outro", () => {
    digitar(campos()[0], "Segredo da Tawper");
    expect(window.localStorage.getItem("vz-survey-rascunho:tok123")).toContain("Segredo da Tawper");
    expect(window.localStorage.getItem("vz-survey-rascunho:outro")).toBeNull();
  });
});
