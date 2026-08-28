import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ItemDescription } from "../src/components/client-dashboard";

const html = (text: string) => renderToStaticMarkup(<ItemDescription text={text} />);
const DESCRIPTION = "**Direcionamento**\ngravar na loja\n\n**Roteiro**\ncena 1: abre a porta\ncena 2: fala o preço\n\n**Legenda**\nvem conferir";

describe("botão de copiar roteiro na aprovação do cliente", () => {
  it("1. o botão aparece ao lado do cabeçalho do roteiro", () => {
    const out = html(DESCRIPTION);
    expect(out).toContain("cd-copy-script");
    expect(out.indexOf("cd-script-heading")).toBeLessThan(out.indexOf("cd-copy-script"));
  });

  it("2. nenhuma parte da descrição se perde ao abrir espaço pro botão", () => {
    const out = html(DESCRIPTION);
    for (const trecho of ["gravar na loja", "cena 1: abre a porta", "cena 2: fala o preço", "vem conferir", "Direcionamento", "Legenda"]) {
      expect(out).toContain(trecho);
    }
  });

  it("3. descrição sem seção de roteiro não ganha botão órfão", () => {
    expect(html("**Legenda**\nsó a legenda")).not.toContain("cd-copy-script");
  });

  it("4. cabeçalho de roteiro sem texto embaixo também não ganha botão", () => {
    expect(html("**Roteiro**\n\n**Legenda**\ntexto")).not.toContain("cd-copy-script");
  });

  it("5. item antigo, sem seção nenhuma, continua renderizando igual", () => {
    const out = html("uma descrição escrita antes desse padrão existir");
    expect(out).toContain("uma descrição escrita antes desse padrão existir");
    expect(out).not.toContain("cd-copy-script");
  });
});
