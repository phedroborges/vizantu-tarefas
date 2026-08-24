import { describe, expect, it } from "vitest";
import { DESCRIPTION_SECTIONS, emptySections, parseDescription, serializeDescription } from "../src/lib/description-sections";

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
});
