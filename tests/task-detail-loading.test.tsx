// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Task } from "@/lib/types";
const { editor } = vi.hoisted(() => ({ editor: vi.fn() }));
vi.mock("@/components/task-modal", () => ({ TaskModal: (props: { task: Task }) => { editor(props.task); return <textarea aria-label="Descrição" defaultValue={props.task.description} />; } }));
import { TaskDetailLoader } from "@/components/task-detail-loader";
let root: Root, host: HTMLDivElement;
const fetchMock = vi.fn();
const preview = { id: "t1", name: "Reels", preview: true, description: "", comments: [], images: [] } as unknown as Task;
const full = { ...preview, preview: undefined, description: "Captação, aprovação e ação", comments: [{ text: "Preservar" }] };
const props = { task: preview, onClose: vi.fn() } as unknown as ComponentProps<typeof TaskDetailLoader>;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); editor.mockClear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("só permite editar depois de receber descrição e comentários completos", async () => {
  let finish!: (value: Response) => void;
  fetchMock.mockReturnValue(new Promise<Response>(resolve => { finish = resolve; }));
  await act(async () => root.render(<TaskDetailLoader {...props} />));
  expect(editor).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Carregando descrição");
  await act(async () => finish(Response.json({ task: full })));
  expect(editor).toHaveBeenCalledWith(full);
  expect(document.querySelector("textarea")?.value).toBe(full.description);
  expect(fetchMock).toHaveBeenCalledWith("/api/tasks/t1?detail=1", expect.objectContaining({ cache: "no-store" }));
});
it("falha e resposta de outra tarefa nunca abrem um formulário vazio; permite tentar novamente", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ task: { ...full, id: "other" } })).mockResolvedValueOnce(Response.json({ task: full }));
  await act(async () => root.render(<TaskDetailLoader {...props} />));
  expect(editor).not.toHaveBeenCalled();
  await act(async () => [...document.querySelectorAll("button")].find(b => b.textContent === "Tentar novamente")!.click());
  expect(editor).toHaveBeenCalledWith(full);
});
it("fechar cancela a requisição pendente", async () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  await act(async () => root.render(<TaskDetailLoader {...props} />));
  const signal = fetchMock.mock.calls[0][1].signal;
  await act(async () => root.render(null));
  expect(signal.aborted).toBe(true);
  expect(editor).not.toHaveBeenCalled();
});
