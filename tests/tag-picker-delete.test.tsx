// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TagPickerPopover } from "../src/components/tag-picker";
import type { Tag } from "../src/lib/types";
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
let root: Root, container: HTMLDivElement;
let index = 0;
const fetchMock = vi.fn(), onChange = vi.fn();
const click = async (element: Element | null | undefined) => { expect(element).toBeTruthy(); await act(async () => (element as HTMLElement).click()); };
const button = (label: string) => [...container.querySelectorAll("button")].find((node) => node.textContent === label);
async function mount(kind: "formato" | "canal" = "formato") {
  const tag: Tag = { id: `tag-${++index}`, kind, label: "Etiqueta de teste", createdAt: "2026-09-13" };
  await act(async () => root.render(<TagPickerPopover kind={kind} catalog={[tag]} selectedIds={[tag.id]} onChange={onChange} onCatalogUpdate={() => {}} trigger="Selecionar" />));
  return tag;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", fetchMock);
  vi.clearAllMocks(); container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
describe("lixeira no seletor de etiquetas", () => {
  it.each(["formato", "canal"] as const)("exclui %s apenas após confirmar e remove da seleção", async (kind) => {
    const tag = await mount(kind);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await click(container.querySelector('[aria-label="Excluir etiqueta Etiqueta de teste"]'));
    expect(fetchMock).not.toHaveBeenCalled();
    await click(button("Excluir etiqueta"));
    expect(fetchMock).toHaveBeenCalledWith(`/api/tags/${tag.id}`, { method: "DELETE" });
    expect(container.querySelector(".tag-popover-option")).toBeNull();
    expect(onChange).toHaveBeenCalledWith([]);
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("cancelar mantém a etiqueta", async () => {
    await mount(); await click(container.querySelector(".tag-popover-delete")); await click(button("Cancelar"));
    expect(fetchMock).not.toHaveBeenCalled(); expect(container.querySelector(".tag-popover-option")).not.toBeNull();
  });
  it("falha mantém a etiqueta e mostra o motivo", async () => {
    await mount(); fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "Acesso negado." }) });
    await click(container.querySelector(".tag-popover-delete")); await click(button("Excluir etiqueta"));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Acesso negado.");
    expect(container.querySelector(".tag-popover-option")).not.toBeNull(); expect(onChange).not.toHaveBeenCalled();
  });
});
