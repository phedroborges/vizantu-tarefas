// @vitest-environment jsdom
// isEditing lê o elemento focado, então este arquivo precisa de DOM. Os
// demais testes do projeto rodam em node e continuam assim.

import { describe, expect, it } from "vitest";
import { LIVE_REFRESH_MS, describeFreshness, isEditing } from "../src/lib/use-live-refresh";

function element(tag: string, contentEditable = false): Element {
  const node = document.createElement(tag);
  if (contentEditable) node.setAttribute("contenteditable", "true");
  // jsdom não deriva isContentEditable do atributo, então travamos aqui.
  Object.defineProperty(node, "isContentEditable", { value: contentEditable });
  return node;
}

describe("trava de digitação", () => {
  // O motivo de existir: revalidar a árvore embaixo do cursor enquanto a
  // pessoa escreve é desconfortável, e o autosave do guia do cliente dura
  // 700ms, então a janela de digitação é real.
  it("adia enquanto o foco está em campo de texto", () => {
    expect(isEditing(element("input"))).toBe(true);
    expect(isEditing(element("textarea"))).toBe(true);
    expect(isEditing(element("select"))).toBe(true);
    expect(isEditing(element("div", true))).toBe(true);
  });

  it("não adia fora de campo de texto", () => {
    expect(isEditing(element("div"))).toBe(false);
    expect(isEditing(element("button"))).toBe(false);
    expect(isEditing(element("a"))).toBe(false);
  });

  it("não quebra sem elemento focado", () => {
    expect(isEditing(null)).toBe(false);
  });
});

describe("idade dos dados", () => {
  const base = 1_700_000_000_000;

  it("mostra agora logo depois de atualizar", () => {
    expect(describeFreshness(base, base)).toBe("agora");
    expect(describeFreshness(base, base + 30_000)).toBe("agora");
  });

  // O corte fica acima do intervalo de 20s de propósito: com a atualização
  // rodando, o rótulo nunca deveria sair de "agora" numa aba visível.
  it("o corte de agora é maior que o intervalo automático", () => {
    expect(describeFreshness(base, base + LIVE_REFRESH_MS)).toBe("agora");
  });

  it("vira minutos passado o corte", () => {
    expect(describeFreshness(base, base + 60_000)).toBe("há 1 min");
    expect(describeFreshness(base, base + 12 * 60_000)).toBe("há 12 min");
  });

  it("vira horas e concorda o singular", () => {
    expect(describeFreshness(base, base + 60 * 60_000)).toBe("há 1 hora");
    expect(describeFreshness(base, base + 3 * 60 * 60_000)).toBe("há 3 horas");
  });

  // Relógio do servidor e do navegador não batem, e na hidratação os dois
  // calculam o mesmo rótulo. Diferença negativa não pode virar "há -1 min".
  it("não produz tempo negativo quando os relógios divergem", () => {
    expect(describeFreshness(base, base - 5_000)).toBe("agora");
  });
});
