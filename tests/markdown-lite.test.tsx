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
    expect(out).toContain("</a>.");
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

  it("9. o cartão de link bloqueia foco e ponteiro de chegarem ao campo editor", () => {
    const out = html("https://exemplo.com");
    expect(out).toContain('class="markdown-lite-link"');
    expect(out).toContain('target="_blank"');
  });
});

describe("markdown-lite: imagem dentro da descrição", () => {
  it("![](url) vira <img>, não link com colchetes soltos", () => {
    const out = html("![](https://cdn.exemplo.com/ref.png)");
    expect(out).toContain('<img src="https://cdn.exemplo.com/ref.png"');
    expect(out).not.toContain("![");
    expect(out).not.toContain("](");
  });

  it("mantém o texto ao redor — a imagem fica onde foi colada", () => {
    const out = html("Cena 1: abre no pátio\n![](https://cdn.exemplo.com/a.jpg)\nCena 2: corta pro rosto");
    expect(out).toContain("Cena 1: abre no pátio");
    expect(out).toContain('src="https://cdn.exemplo.com/a.jpg"');
    expect(out).toContain("Cena 2: corta pro rosto");
  });

  it("usa o alt quando ele existe", () => {
    const out = html("![enquadramento da abertura](https://cdn.exemplo.com/b.png)");
    expect(out).toContain('alt="enquadramento da abertura"');
  });

  it("não confunde link normal com imagem", () => {
    const out = html("[a referência](https://exemplo.com/x)");
    expect(out).toContain('href="https://exemplo.com/x"');
    expect(out).not.toContain("<img");
  });

  it("continua recusando esquema que não seja http(s) no src", () => {
    const out = html("![x](javascript:alert(1)) ![y](data:image/png;base64,AAAA)");
    // Vira texto escapado, nunca elemento: nenhum src/href carrega o esquema.
    expect(out).not.toContain("<img");
    expect(out).not.toContain('src="javascript:');
    expect(out).not.toContain('href="javascript:');
    expect(out).not.toContain('src="data:');
    expect(out).toContain("markdown-lite-line");
  });

  it("negrito e link seguem funcionando na mesma linha da imagem", () => {
    const out = html("**Referência:** ![](https://cdn.exemplo.com/c.png) veja https://exemplo.com");
    expect(out).toContain("<strong>Referência:</strong>");
    expect(out).toContain('src="https://cdn.exemplo.com/c.png"');
    expect(out).toContain('href="https://exemplo.com"');
  });
});
