// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ClientPlansMenu } from "@/components/client-plans-menu";
import { ClientDashboard, type DashboardItem } from "@/components/client-dashboard";
import { PlanoDetailView } from "@/components/plano-detail-view";
import type { Plan, Project, Task } from "@/lib/types";

const project = { id: "client", name: "Casa Caramelo" } as Project;
const plans = ["09", "10", "11"].map(m => ({ id: m, projectId: "client", title: `Casa Caramelo ${m}/26`, periodMonth: `2026-${m}`, kind: "content", status: "draft" } as Plan));
const task = (id: string, assigneeId: string) => ({ id, projectId: "client", planId: "10", name: id, assigneeId, kind: "conteudo", status: "rascunho", comments: [], statusHistory: [], images: [], formatTagIds: [], channelTagIds: [], categoryTagIds: [] } as unknown as Task);
let container: HTMLDivElement; let root: Root;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.setItem("vizantu-client-reviewer-name", "Maria");
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function change(select: HTMLSelectElement, value: string) {
  await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
it("abre no mês atual e permite escolher setembro no topo para consultar o histórico", async () => {
  await act(async () => root.render(<ClientPlansMenu project={project} plans={plans} tasks={[]} setTasks={vi.fn()} canPlan today="2026-10-15" onNewPlan={vi.fn()} />));
  const select = container.querySelector<HTMLSelectElement>('select[aria-label="Mês do plano"]')!;
  expect(select.value).toBe("2026-10");
  expect(container.querySelector('a[href="/planos/10"]')).not.toBeNull();
  expect(container.querySelector('a[href="/planos/09"]')).toBeNull();
  await change(select, "2026-09");
  expect(container.querySelector('a[href="/planos/09"]')).not.toBeNull();
  expect(container.querySelector('a[href="/planos/10"]')).toBeNull();
  expect(container.querySelector(".pq-plan")?.textContent).toContain("Encerrado");
});
it("portal troca de plano sem misturar conteúdos e sem a opção Todos", async () => {
  const item = (month: string): DashboardItem => ({ id: month, planId: month, planTitle: month, planPeriod: `2026-${month}`, name: `Conteúdo ${month}`, status: "aprovacao_copy", approvalStatus: "pending", reviewVersion: 1, dueDate: null, materialLink: null, captacaoLabel: null, formatLabel: null, channelLabel: null, categoryLabel: null, reference: null, description: "Texto", updatedAt: "2026-10-15" });
  const available = plans.filter(p => p.id !== "09").map(p => ({ id: p.id, title: p.title, period: p.periodMonth! }));
  const fetchMock = vi.fn(async (url: string) => { const id = url.includes("11") ? "11" : "10"; return { ok: true, json: async () => ({ items: [item(id)], plans: available, selectedPlanId: id }) }; });
  vi.stubGlobal("fetch", fetchMock);
  await act(async () => root.render(<ClientDashboard clientName="Casa Caramelo" roleTitle={null} city={null} instagramHandle={null} initialItems={[item("09"), item("10")]} initialPlans={available} initialPlanId="10" events={[]} initialScore={null} />));
  expect(container.textContent).toContain("Conteúdo 10"); expect(container.textContent).not.toContain("Conteúdo 09");
  const select = container.querySelector<HTMLSelectElement>('select[aria-label="Plano em exibição"]')!;
  expect([...select.options].some(o => o.textContent === "Todos")).toBe(false);
  await change(select, "11");
  expect(fetchMock).toHaveBeenCalledWith("/api/c/items?planId=11", expect.anything());
  expect(container.textContent).toContain("Conteúdo 11"); expect(container.textContent).not.toContain("Conteúdo 10");
});
const detail = { plan: plans[1], project, initialCaptacoes: [], initialTasks: [task("Minha demanda", "creative"), task("Outra pessoa", "someone")], initialApprovals: [], approvalResponses: [], captureSuggestions: [], members: [], formatTags: [{ id: "reels", label: "Reels", kind: "formato" as const, createdAt: "2026-10-15" }], channelTags: [], categoryTags: [], statusColors: [], currentUserId: "creative" };
it("diretor criativo vê somente suas demandas, sem configuração, pacotes e link do cliente", async () => {
  await act(async () => root.render(<PlanoDetailView {...detail} creativeOnly canEdit={false} />));
  expect(container.textContent).toContain("Minha demanda"); expect(container.textContent).not.toContain("Outra pessoa");
  expect(container.textContent).not.toContain("Pacotes de produção"); expect(container.textContent).not.toContain("Link do cliente");
  expect(container.textContent).not.toContain("Enviar textos pendentes");
});
it("modelo de pacote já vem configurado com cinco conteúdos", async () => {
  await act(async () => root.render(<PlanoDetailView {...detail} />));
  const button = [...container.querySelectorAll("button")].find(b => b.textContent?.includes("Novo pacote"))!;
  await act(async () => button.click());
  expect(container.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("5");
  expect(container.textContent).toContain("Criar pacote com 5 conteúdos");
});
