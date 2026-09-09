// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectSurveyResults } from "../src/components/project-survey-results";
import type { Survey, SurveyQuestion } from "../src/lib/types";

// Quarenta perguntas lidas como lista crua de pergunta/resposta não ensinam
// nada sobre a empresa. Agrupadas nos mesmos blocos em que foram perguntadas,
// viram um documento que dá para ler antes de falar com o cliente.

const NOW = "2026-09-09T12:00:00.000Z";
const q = (id: string, title: string, section?: string): SurveyQuestion =>
  ({ id, title, type: "long_text", required: true, section });

const survey: Survey = {
  id: "s1", projectId: "p1", title: "Diagnóstico de marca", description: "",
  status: "closed", token: "tok", createdAt: NOW, updatedAt: NOW,
  questions: [
    q("a1", "Quem fundou?", "Quem é a empresa"),
    q("a2", "Que problema?", "Quem é a empresa"),
    q("b1", "O que vendem?", "O que vocês vendem"),
    q("b2", "Canais", "O que vocês vendem"),
    q("c1", "Sem resposta", "Prova"),
  ],
  responses: [{
    id: "r1", respondentName: "Paulo (Tawper)", createdAt: NOW,
    answers: [
      { questionId: "a1", value: "O Paulo, em 1998." },
      { questionId: "a2", value: "Faltava reposição na região." },
      { questionId: "b1", value: "Mangueiras e conexões hidráulicas." },
      { questionId: "b2", value: ["Distribuidor", "Representante"] },
      { questionId: "c1", value: "   " },
    ],
  }],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<ProjectSurveyResults surveys={[survey]} />));
});

afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("dossiê da resposta", () => {
  it("agrupa as respostas nos blocos em que foram perguntadas", () => {
    const blocos = [...container.querySelectorAll(".dossie__bloco h3")].map((item) => item.textContent);
    expect(blocos).toEqual(["Quem é a empresa", "O que vocês vendem"]);
  });

  it("mantém a pergunta junto da resposta, para o texto se explicar sozinho", () => {
    const itens = [...container.querySelectorAll(".dossie__item")].map((item) => item.textContent);
    expect(itens[0]).toContain("Quem fundou?");
    expect(itens[0]).toContain("O Paulo, em 1998.");
  });

  it("junta as escolhas múltiplas numa linha só", () => {
    expect(container.textContent).toContain("Distribuidor · Representante");
  });

  // O que não foi respondido some do texto, mas o buraco continua visível no
  // contador — é o que diz se dá para dispensar a reunião ou não.
  it("não inventa bloco para pergunta em branco, e conta o que falta", () => {
    expect(container.textContent).not.toContain("Sem resposta");
    expect(container.querySelector(".dossie__contagem")?.textContent).toBe("4 de 5 respondidas");
  });

  it("identifica quem respondeu", () => {
    expect(container.textContent).toContain("Paulo (Tawper)");
  });
});
