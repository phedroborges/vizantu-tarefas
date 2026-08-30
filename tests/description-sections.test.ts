import { describe, expect, it } from "vitest";
import { DESCRIPTION_SECTIONS, descriptionLayout, emptySections, hasContentSections, parseDescription, serializeDescription, taskKindIsEditable } from "../src/lib/description-sections";

describe("padrão de descrição (seções)", () => {
  it("1. as seções são sempre as mesmas, na mesma ordem", () => {
    expect(DESCRIPTION_SECTIONS.map((s) => s.label)).toEqual(["Direcionamento", "Roteiro", "Legenda", "Referência"]);
  });

  it("2. round-trip preserva o conteúdo de cada seção", () => {
    const sections = { ...emptySections(), direcionamento: "Gravar na loja", roteiro: "Abre com o pet", legenda: "Siga o perfil", referencia: "https://ref" };
    const parsed = parseDescription(serializeDescription(sections));
    expect(parsed.direcionamento).toBe("Gravar na loja");
    expect(parsed.roteiro).toBe("Abre com o pet");
    expect(parsed.legenda).toBe("Siga o perfil");
    expect(parsed.referencia).toBe("https://ref");
  });

  it("3. seção vazia não vira cabeçalho órfão no texto salvo", () => {
    const text = serializeDescription({ ...emptySections(), roteiro: "só o roteiro" });
    expect(text).toBe("**Roteiro**\nsó o roteiro");
    expect(text).not.toContain("Direcionamento");
  });

  it("4. texto antigo sem seção nenhuma não é perdido — cai em 'livre'", () => {
    const parsed = parseDescription("uma descrição escrita antes desse padrão existir");
    expect(parsed.livre).toBe("uma descrição escrita antes desse padrão existir");
    expect(parsed.roteiro).toBe("");
  });

  it("5. legenda permanece em sua própria seção", () => {
    const parsed = parseDescription("**Legenda**\ntexto da legenda");
    expect(parsed.legenda).toBe("texto da legenda");
    expect(parsed.roteiro).toBe("");
  });

  it("6. tarefa avulsa começa na base e vira conteúdo pelo seletor", () => {
    expect(hasContentSections({})).toBe(false);
    expect(hasContentSections({ kind: "tarefa" })).toBe(false);
    expect(hasContentSections({ kind: "conteudo" })).toBe(true);

    const base = descriptionLayout(emptySections(), { content: hasContentSections({ kind: "tarefa" }) });
    expect(base.visible.map((s) => s.label)).toEqual(["Direcionamento", "Referência"]);

    const conteudo = descriptionLayout(emptySections(), { content: hasContentSections({ kind: "conteudo" }) });
    expect(conteudo.visible.map((s) => s.label)).toEqual(["Direcionamento", "Roteiro", "Legenda", "Referência"]);
    expect(conteudo.hidden).toEqual([]);
  });

  it("7. dentro de um plano quem manda é o plano, não o seletor da tarefa", () => {
    // Etapa de marca marcada como conteúdo continua sem roteiro e legenda: o
    // seletor nem aparece ali, então um valor teimoso no banco não vale.
    expect(hasContentSections({ planKind: "brand", kind: "conteudo" })).toBe(false);
    expect(hasContentSections({ planKind: "process", kind: "conteudo" })).toBe(false);
    // E todo item de plano de conteúdo é conteúdo, mesmo com kind "tarefa".
    expect(hasContentSections({ planKind: "content", kind: "tarefa" })).toBe(true);
  });

  it("8. entrega que não vira publicação não pede roteiro nem legenda", () => {
    for (const planKind of ["brand", "process"] as const) {
      const { visible, hidden } = descriptionLayout(emptySections(), { content: hasContentSections({ planKind }) });
      expect(visible.map((s) => s.label)).toEqual(["Direcionamento", "Referência"]);
      expect(hidden.map((s) => s.label)).toEqual(["Roteiro", "Legenda"]);
    }
  });

  it("9. bloco escondido que já tem texto continua aparecendo — nada some da tela", () => {
    const sections = { ...emptySections(), roteiro: "escrito quando marca herdava as seções de conteúdo" };
    const { visible, hidden } = descriptionLayout(sections, { content: hasContentSections({ planKind: "brand" }) });
    expect(visible.map((s) => s.label)).toEqual(["Direcionamento", "Roteiro", "Referência"]);
    expect(hidden.map((s) => s.label)).toEqual(["Legenda"]);
  });

  it("10. voltar de conteúdo pra tarefa não some com o roteiro já escrito", () => {
    const sections = { ...emptySections(), roteiro: "abre com o pet" };
    const { visible } = descriptionLayout(sections, { content: hasContentSections({ kind: "tarefa" }) });
    expect(visible.map((s) => s.label)).toEqual(["Direcionamento", "Roteiro", "Referência"]);
    expect(serializeDescription(sections)).toContain("**Roteiro**");
  });

  it("11. bloco revelado à mão aparece mesmo vazio", () => {
    const { visible } = descriptionLayout(emptySections(), { content: false, revealed: ["legenda"] });
    expect(visible.map((s) => s.label)).toEqual(["Direcionamento", "Legenda", "Referência"]);
  });

  it("12. esconder um bloco não muda o texto salvo — só a tela", () => {
    const sections = { ...emptySections(), direcionamento: "definir a plataforma", roteiro: "sobrou de antes" };
    expect(serializeDescription(sections)).toContain("**Roteiro**");
  });

  it("13. o seletor só aparece onde ele decide alguma coisa", () => {
    expect(taskKindIsEditable({})).toBe(true);
    expect(taskKindIsEditable({ planKind: "content" })).toBe(false);
    expect(taskKindIsEditable({ planKind: "brand" })).toBe(false);
  });
});
