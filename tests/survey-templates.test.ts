import { describe, expect, it } from "vitest";
import { SECOES_DIAGNOSTICO, SURVEY_TEMPLATES, questionsForTemplate } from "../src/lib/survey-templates";

let contador = 0;
const id = () => `q${++contador}`;

describe("modelos de pesquisa", () => {
  const diagnostico = questionsForTemplate("brand_diagnosis", id);

  it("o diagnóstico cobre todos os blocos, na ordem", () => {
    const blocos = [...new Set(diagnostico.map((question) => question.section))];
    expect(blocos).toEqual([...SECOES_DIAGNOSTICO]);
  });

  it("nenhuma pergunta do diagnóstico fica sem bloco", () => {
    expect(diagnostico.filter((question) => !question.section)).toEqual([]);
  });

  it("cada pergunta nasce com id próprio", () => {
    const ids = diagnostico.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Uma pergunta aberta sem exemplo volta em uma linha, e aí a reunião que o
  // formulário deveria evitar acontece do mesmo jeito. As opcionais são as
  // delicadas (faturamento, reclamação, quase-quebra) e podem ficar sem dica.
  it("as perguntas abertas obrigatórias explicam que tipo de resposta se espera", () => {
    const semDica = diagnostico.filter((question) => question.type === "long_text" && question.required && !question.description);
    expect(semDica.map((question) => question.title)).toEqual([
      "Em quais regiões, estados ou mercados vocês vendem hoje, e onde querem crescer?",
      "Quando vocês ganham, o que pesou na decisão?",
      "Daqui a três anos, o que você quer que digam sobre a empresa quando ela não estiver na sala?",
    ]);
  });

  it("termina perguntando o que não foi perguntado", () => {
    expect(diagnostico.at(-1)!.title).toContain("O que eu não perguntei");
  });

  it("o onboarding antigo continua existindo e sem blocos", () => {
    const onboarding = questionsForTemplate("brand_onboarding", id);
    expect(onboarding.length).toBe(42);
    expect(onboarding.every((question) => question.section === undefined)).toBe(true);
  });

  it("modelo em branco e desconhecido não quebram", () => {
    expect(questionsForTemplate("blank", id)).toEqual([]);
    expect(questionsForTemplate(undefined, id)).toEqual([]);
  });

  it("todo modelo do seletor sabe se construir", () => {
    for (const modelo of SURVEY_TEMPLATES) {
      expect(() => questionsForTemplate(modelo.value, id), modelo.value).not.toThrow();
    }
  });
});
