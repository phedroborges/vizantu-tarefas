// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveMarkdownEditor, markdownFromEditor } from "../src/components/live-markdown-editor";

let root: Root | undefined;
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

function mount(value = "Texto inicial", onChange = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  function Field() {
    const [text, setText] = useState(value);
    return <LiveMarkdownEditor value={text} onChange={(next) => { onChange(next); setText(next); }} />;
  }
  act(() => root!.render(<Field />));
  return { editor: host.querySelector('[contenteditable="true"]') as HTMLDivElement, onChange };
}

function input(editor: HTMLElement, text: string, composing = false) {
  const node = editor.firstChild!.firstChild!;
  node.textContent = text;
  const range = document.createRange();
  range.setStart(node, text.length);
  range.collapse(true);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  act(() => editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: composing ? "insertCompositionText" : "insertText", isComposing: composing })));
  return node;
}

describe("editor visual de markdown", () => {
  it("mantém títulos e negritos no texto persistido", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div data-md-heading="3">Título<br></div><div>Texto <strong>importante</strong><br></div>';
    expect(markdownFromEditor(root)).toBe("### Título\nTexto **importante**");
  });
  it("lê texto que o navegador insere diretamente na raiz do editor", () => {
    const root = document.createElement("div"); root.append("### Título digitado");
    expect(markdownFromEditor(root)).toBe("### Título digitado");
  });
  it("preserva linhas vazias, Shift+Enter e texto formatado na raiz", () => {
    const root = document.createElement("div");
    root.innerHTML = '<div>Primeira<br>continuação</div><div><br></div><div>Terceira</div>';
    expect(markdownFromEditor(root)).toBe("Primeira\ncontinuação\n\nTerceira");
    root.innerHTML = 'Texto <strong>importante</strong> com acentuação';
    expect(markdownFromEditor(root)).toBe("Texto **importante** com acentuação");
  });
  it("mantém o mesmo campo, nó de texto, foco e cursor quando o pai recebe a edição", () => {
    const { editor, onChange } = mount();
    editor.focus();
    const node = input(editor, "Texto editado");
    expect(editor.isConnected).toBe(true);
    expect(document.activeElement).toBe(editor);
    expect(editor.firstChild!.firstChild).toBe(node);
    expect(window.getSelection()?.anchorNode).toBe(node);
    expect(window.getSelection()?.anchorOffset).toBe(13);
    expect(onChange).toHaveBeenLastCalledWith("Texto editado");
    input(editor, "Texto editado de novo");
    expect(document.activeElement).toBe(editor);
  });
  it.each(["á", "ã", "ê", "ç", "é", "í", "ó", "ú"])("espera terminar a composição de %s antes de emitir para salvar", (letter) => {
    const { editor, onChange } = mount("a");
    editor.focus();
    act(() => editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    const node = input(editor, "´", true);
    expect(onChange).not.toHaveBeenCalled();
    node.textContent = letter;
    act(() => editor.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: letter })));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(letter);
    act(() => editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" })));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(editor);
    expect(editor.textContent).toBe(letter);
  });
  it("não reconstrói o texto quando uma resposta de salvamento renderiza o pai novamente", () => {
    const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    const onChange = vi.fn();
    const render = (value: string) => act(() => root!.render(<LiveMarkdownEditor value={value} onChange={onChange} />));
    render("Descrição");
    const editor = host.firstChild as HTMLDivElement; editor.focus();
    const node = input(editor, "Descrição com ação");
    render("Descrição com ação");
    expect(document.activeElement).toBe(editor);
    expect(editor.firstChild!.firstChild).toBe(node);
    expect(window.getSelection()?.anchorNode).toBe(node);
  });
  it("formata marcações ao sair do campo, mantendo o markdown salvo", () => {
    const { editor, onChange } = mount("Texto"); editor.focus();
    input(editor, "### Atenção **importante**");
    act(() => editor.blur());
    expect(editor.querySelector('[data-md-heading="3"] strong')?.textContent).toBe("importante");
    expect(markdownFromEditor(editor)).toBe("### Atenção **importante**");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it("renderiza a formatação inicial e mantém HTML como texto", () => {
    const { editor } = mount("### Ação\n**Ênfase**\n<script>alert(1)</script>");
    expect(editor.querySelector("strong")?.textContent).toBe("Ênfase");
    expect(editor.querySelector("script")).toBeNull();
    expect(editor.textContent).toContain("<script>alert(1)</script>");
  });
});
