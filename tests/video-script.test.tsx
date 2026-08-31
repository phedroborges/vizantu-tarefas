import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ItemDescription } from "../src/components/client-dashboard";
import { ScriptTable } from "../src/components/script-table";
import { parseVideoScript } from "../src/lib/video-script";

const ROTEIRO = [
  "CENA 1: ABERTURA",
  "Imagem: responsável técnica diante do local.",
  "Fala: O número que aparece nesse aparelho não vira laudo sozinho.",
  "Lettering: não vira laudo sozinho",
  "",
  "CENA 2: ENTENDER O CASO",
  "Imagem: equipe conversando com o cliente.",
  "Fala: Antes de medir, a gente precisa entender qual é a fonte do ruído.",
  "",
  "CENA 3: CTA",
  "Imagem: aplicação da marca.",
  "Fala: Fale com a Parceria Ambiental pelo WhatsApp.",
  "Lettering: fale com a gente",
].join("\n");

const CARROSSEL = [
  "SLIDE 1",
  "Visual: equipamento em primeiro plano.",
  "Texto: Sua empresa pode precisar de um laudo.",
  "",
  "SLIDE 2",
  "Visual: operação da empresa.",
  "Texto: Máquinas e obras geram ruído.",
].join("\n");

const html = (text: string) => renderToStaticMarkup(<ItemDescription text={text} />);

describe("roteiro de vídeo virando tabela", () => {
  it("1. separa cada cena em cena, fala e lettering", () => {
    const script = parseVideoScript(ROTEIRO);
    expect(script?.scenes).toHaveLength(3);
    expect(script?.scenes[0]).toMatchObject({
      number: "1",
      title: "ABERTURA",
      cena: "responsável técnica diante do local.",
      fala: "O número que aparece nesse aparelho não vira laudo sozinho.",
      lettering: "não vira laudo sozinho",
    });
  });

  it("2. cena sem lettering fica sem lettering, não vira campo pendente", () => {
    expect(parseVideoScript(ROTEIRO)?.scenes[1].lettering).toBe("");
  });

  it("3. nenhuma linha escrita se perde no caminho da tabela", () => {
    const script = parseVideoScript(ROTEIRO);
    const dentro = script!.scenes.flatMap((s) => [s.cena, s.fala, s.lettering]).join("\n");
    for (const linha of ROTEIRO.split("\n")) {
      const conteudo = linha.replace(/^[^:]+:\s*/, "").trim();
      if (!conteudo || /^CENA/i.test(linha)) continue;
      expect(dentro).toContain(conteudo);
    }
  });

  it("4. aceita a escrita antiga (Visual, Áudio, Letter) sem pedir conversão", () => {
    const antigo = "Cena 1 - abertura\nVisual: a loja abrindo\nÁudio: bom dia, gente\nLetter: bom dia\n\nCena 2\nVisual: o preço na tela\nÁudio: hoje sai por dez reais";
    const script = parseVideoScript(antigo);
    expect(script?.scenes[0]).toMatchObject({ cena: "a loja abrindo", fala: "bom dia, gente", lettering: "bom dia" });
    expect(script?.scenes[1].fala).toBe("hoje sai por dez reais");
  });

  it("5. linha solta continua no campo aberto, em vez de sumir", () => {
    const script = parseVideoScript("CENA 1\nFala: primeira frase\nsegunda frase da mesma fala\n\nCENA 2\nFala: fim");
    expect(script?.scenes[0].fala).toBe("primeira frase\nsegunda frase da mesma fala");
  });

  it("6. carrossel em slides não vira tabela de vídeo", () => {
    expect(parseVideoScript(CARROSSEL)).toBeNull();
  });

  it("7. post estático e roteiro de uma cena só também não viram tabela", () => {
    expect(parseVideoScript("HEADLINE\nLaudo de ruído ambiental\n\nCTA VISUAL\nChame no WhatsApp.")).toBeNull();
    expect(parseVideoScript("CENA 1\nFala: única cena")).toBeNull();
  });

  it("8. a tabela mostra os três cabeçalhos e o conteúdo de cada cena", () => {
    const out = renderToStaticMarkup(<ScriptTable script={parseVideoScript(ROTEIRO)!} />);
    for (const trecho of ["Cena", "Fala", "Lettering", "Cena 1", "ABERTURA", "não vira laudo sozinho"]) {
      expect(out).toContain(trecho);
    }
  });

  it("9. no painel do cliente o roteiro de vídeo aparece como tabela", () => {
    const out = html(`**Direcionamento**\ngravar em campo\n\n**Roteiro**\n${ROTEIRO}\n\n**Legenda**\nvem ver`);
    expect(out).toContain("script-table");
    // A legenda e o direcionamento continuam fora da tabela, inteiros.
    expect(out).toContain("gravar em campo");
    expect(out).toContain("vem ver");
    expect(out.indexOf("script-table")).toBeLessThan(out.indexOf("vem ver"));
  });

  it("10. o botão de copiar segue copiando o roteiro em texto, não a tabela", () => {
    const out = html(`**Roteiro**\n${ROTEIRO}`);
    expect(out).toContain("cd-copy-script");
  });

  it("11. roteiro que não é de vídeo continua renderizando como texto", () => {
    const out = html(`**Roteiro**\n${CARROSSEL}`);
    expect(out).not.toContain("script-table");
    expect(out).toContain("Sua empresa pode precisar de um laudo.");
  });
});
