import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderMarkdownLite } from "../src/components/markdown-lite";

const html = (text: string) => renderToStaticMarkup(<>{renderMarkdownLite(text)}</>);

describe("markdown-lite: links clicáveis na referência", () => {
  it("1. link markdown vira <a> com o texto como rótulo", () => {
    const out = html("* [WSAVA: diretrizes de nutrição](https://wsava.org/global-guidelines/)");
    expect(out).toContain('href="https://wsava.org/global-guidelines/"');
    expect(out).toContain("WSAVA: diretrizes de nutrição");
    expect(out).not.toContain("](");
  });

  it("2. URL solta (referência de trend) também vira link", () => {
    const out = html("https://www.instagram.com/reel/DbI8Ca7xJ5u/");
    expect(out).toContain('href="https://www.instagram.com/reel/DbI8Ca7xJ5u/"');
  });

  it("3. abre em nova aba sem vazar a sessão do cliente", () => {
    const out = html("https://exemplo.com");
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("4. o https de dentro de um link markdown não vira um segundo link", () => {
    const out = html("[Merck](https://merckvetmanual.com/x)");
    expect(out.match(/<a /g)).toHaveLength(1);
  });

  it("5. pontuação de fim de frase fica fora do endereço", () => {
    const out = html("A referência é https://exemplo.com.");
    expect(out).toContain('href="https://exemplo.com"');
    expect(out).toContain("com</a>.");
  });

  it("6. esquema perigoso continua sendo texto, nunca link", () => {
    const out = html("javascript:alert(1) e [x](javascript:alert(1))");
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("javascript:alert(1)\"");
  });

  it("7. negrito e título continuam funcionando junto com link", () => {
    const out = html("### Referência\n**Briefing** em https://exemplo.com");
    expect(out).toContain("<h3");
    expect(out).toContain("<strong>Briefing</strong>");
    expect(out).toContain("<a ");
  });

  it("8. descrição sem link nenhum não ganha <a>", () => {
    const out = html("**Roteiro**\nA gente começou uma campanha aqui na Casa Caramelo.");
    expect(out).not.toContain("<a ");
  });
});
