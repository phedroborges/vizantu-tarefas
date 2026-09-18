// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TarefasView } from "@/components/tarefas-view";
import { defaultPreferences } from "@/lib/preferences";
import type { Task } from "@/lib/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
let root: Root, host: HTMLDivElement;
const tasks: Task[] = Array.from({ length: 120 }, (_, i) => ({ id: `t${i}`, name: `Produção ${String(i).padStart(3, "0")}`, projectId: "p", kind: "tarefa", status: "em_criacao", lists: [], images: [], formatTagIds: [], channelTagIds: [], categoryTagIds: [], comments: [], statusHistory: [], createdAt: "2026-09-01", updatedAt: "2026-09-01" }));
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}))); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("monta só 50 linhas, navega e encontra tarefas fora da primeira página", async () => {
  await act(async () => root.render(<TarefasView currentUserId="member" initialTasks={tasks} initialProjects={[]} initialMembers={[]} initialFormatTags={[]} initialChannelTags={[]} initialStatusColors={[]} initialPreferences={defaultPreferences()} />));
  expect(host.textContent).toContain("Página 1 de 3");
  expect(host.textContent).toContain("Produção 049");
  expect(host.textContent).not.toContain("Produção 050");
  await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Próxima")!.click());
  expect(host.textContent).toContain("Produção 050");
  expect(host.textContent).not.toContain("Produção 049");
  const input = host.querySelector('input[aria-label="Buscar tarefas"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Produção 119"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(host.textContent).toContain("Produção 119");
  expect(host.textContent).not.toContain("Produção 050");
});
