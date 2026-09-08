// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { markdownFromEditor } from "../src/components/live-markdown-editor";

describe("editor visual de markdown", () => {
  it("mantém títulos e negritos no texto persistido", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-md-heading="3">Título<br></div><div>Texto <strong>importante</strong><br></div>';
    expect(markdownFromEditor(root)).toBe("### Título\nTexto **importante**");
  });

  it("lê texto que o navegador insere diretamente na raiz do editor", () => {
    const root = document.createElement("div");
    root.append("### Título digitado");
    expect(markdownFromEditor(root)).toBe("### Título digitado");
  });
});
