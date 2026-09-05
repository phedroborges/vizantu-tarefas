// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { RichTextField } from "../src/components/rich-text-field";

let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

describe("RichTextField em modo de leitura", () => {
  it("abre o link sem transformar a descrição em textarea", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<RichTextField value="Referência: https://exemplo.com" onChange={() => {}} />));
    const link = host.querySelector("a") as HTMLAnchorElement;
    act(() => {
      link.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(host.querySelector("textarea")).toBeNull();
    expect(link.href).toBe("https://exemplo.com/");
  });

  it("mantém a edição ao clicar no texto normal", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<RichTextField value="Texto editável" onChange={() => {}} />));
    act(() => (host.querySelector(".rich-text-view") as HTMLElement).click());
    expect(host.querySelector("textarea")).not.toBeNull();
  });
});
