import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { executeTool } from "../src/lib/assistant-tools";
import type { CurrentUser } from "../src/lib/current-user";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Testa a camada de tools da IA (planos/avisos) direto contra o banco real,
// sem precisar da OPENAI_API_KEY — executeTool() já é só TypeScript puro
// chamando storage.ts, o modelo da OpenAI nunca entra nesse caminho.
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

let projectId: string;
const donoUser: CurrentUser = {
  id: "",
  name: "IA Teste",
  email: "ia-teste@vizantu.com.br",
  role: "dono",
  aiEnabled: true,
  active: true,
  accessibleProjectIds: "all",
  accessibleListKinds: "all",
};
const viewerUser: CurrentUser = { ...donoUser, role: "visualizador", accessibleProjectIds: "all", accessibleListKinds: "all" };

beforeAll(async () => {
  const now = new Date().toISOString();
  const { data: project } = await db
    .from("projects")
    .insert({ name: "[E2E] Vitest assistant-tools", status: "ativo", created_at: now, updated_at: now })
    .select()
    .single();
  projectId = project!.id;
});

afterAll(async () => {
  if (projectId) await db.from("projects").delete().eq("id", projectId);
});

describe("assistant-tools: planos e avisos", () => {
  it("1. create_plan cria um plano de conteúdo vinculado ao projeto certo", async () => {
    const result = (await executeTool(
      "create_plan",
      JSON.stringify({ title: "[E2E] Plano via IA", projectName: "[E2E] Vitest assistant-tools", kind: "content" }),
      donoUser,
    )) as { created: { id: string; title: string } };
    expect(result.created.title).toBe("[E2E] Plano via IA");

    const { data: row } = await db.from("plans").select("project_id").eq("id", result.created.id).single();
    expect(row!.project_id).toBe(projectId);
  });

  it("2. add_plan_item resolve/cria a captação pelo label e o item entra nela", async () => {
    const plan = (await executeTool(
      "create_plan",
      JSON.stringify({ title: "[E2E] Plano item", projectName: "[E2E] Vitest assistant-tools", kind: "content" }),
      donoUser,
    )) as { created: { id: string } };
    const item = (await executeTool(
      "add_plan_item",
      JSON.stringify({ planId: plan.created.id, name: "Vídeo #1", captacaoLabel: "1ª Captação", description: "**Roteiro**\nRoteiro via IA" }),
      donoUser,
    )) as { created: { id: string; planId: string } };
    expect(item.created.planId).toBe(plan.created.id);

    const detail = (await executeTool("get_plan", JSON.stringify({ planId: plan.created.id }), donoUser)) as {
      captacoes: string[];
      items: { name: string; captacao: string | null; hasDescription: boolean }[];
    };
    expect(detail.captacoes).toEqual(["1ª Captação"]);
    expect(detail.items[0]).toMatchObject({ name: "Vídeo #1", captacao: "1ª Captação", hasDescription: true });
  });

  it("3. update_plan_item edita o roteiro de um item já criado", async () => {
    const plan = (await executeTool(
      "create_plan",
      JSON.stringify({ title: "[E2E] Plano update", projectName: "[E2E] Vitest assistant-tools", kind: "content" }),
      donoUser,
    )) as { created: { id: string } };
    const item = (await executeTool("add_plan_item", JSON.stringify({ planId: plan.created.id, name: "Post #1" }), donoUser)) as {
      created: { id: string };
    };
    const updated = (await executeTool(
      "update_plan_item",
      JSON.stringify({ taskId: item.created.id, description: "Roteiro atualizado", status: "em_criacao" }),
      donoUser,
    )) as { updated: { status: string } };
    expect(updated.updated.status).toBe("Em criação");

    const { data: row } = await db.from("tasks").select("description, lists").eq("id", item.created.id).single();
    expect(row!.description).toBe("Roteiro atualizado");
    expect(row!.lists).toEqual(["criativa"]); // confirma que a automação também dispara vindo da IA
  });

  it("4. visualizador é bloqueado nas tools mutantes de plano/aviso", async () => {
    const result = await executeTool(
      "create_plan",
      JSON.stringify({ title: "Não deveria criar", projectName: "[E2E] Vitest assistant-tools", kind: "content" }),
      viewerUser,
    );
    expect(result).toMatchObject({ error: expect.stringContaining("somente leitura") });
  });

  it("5. create_announcement recusa escopo 'all' pra quem não é dono", async () => {
    const editorUser: CurrentUser = { ...donoUser, role: "editor" };
    const result = (await executeTool(
      "create_announcement",
      JSON.stringify({ body: "[E2E] Aviso via IA", scope: "all" }),
      editorUser,
    )) as { error?: string; created?: { id: string } };
    expect(result.error).toContain("Só o dono");

    const asDono = (await executeTool("create_announcement", JSON.stringify({ body: "[E2E] Aviso via IA", scope: "all" }), donoUser)) as {
      created: { id: string };
    };
    expect(asDono.created.id).toBeTruthy();
    await db.from("announcements").delete().eq("id", asDono.created.id);
  });
});
