import { writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

export const FIXTURE_PATH = path.resolve(__dirname, ".fixtures.json");
export const TEST_PASSWORD = "TesteVizantu#2026";
export const TEST_EMAIL = "e2e-teste@vizantu.com.br";
export const TEST_VIEWER_EMAIL = "e2e-visualizador@vizantu.com.br";

async function createTestMember(db: SupabaseClient, email: string, name: string, role: string) {
  const { data: existingUsers } = await db.auth.admin.listUsers();
  const stale = existingUsers?.users.find((u) => u.email === email);
  if (stale) await db.auth.admin.deleteUser(stale.id);

  const { data: authUser, error: authError } = await db.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (authError || !authUser.user) throw new Error(`Falha ao criar usuário de teste (${email}): ${authError?.message}`);

  const now = new Date().toISOString();
  await db.from("members").insert({ id: authUser.user.id, name, email, role, ai_enabled: false, active: true, created_at: now, updated_at: now });
  return authUser.user.id;
}

// Cria membros de teste isolados (e-mails dedicados, nunca usados por pessoa
// real) só pra rodar a suíte contra o banco de produção sem tocar nas contas
// reais do time — global-teardown apaga tudo de novo no fim.
export default async function globalSetup() {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes (.env.local) — necessários pra rodar os testes.");
  }
  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const memberId = await createTestMember(db, TEST_EMAIL, "E2E Teste (dono)", "dono");
  const viewerId = await createTestMember(db, TEST_VIEWER_EMAIL, "E2E Teste (visualizador)", "visualizador");

  const now = new Date().toISOString();
  const { data: project } = await db
    .from("projects")
    .insert({ name: "[E2E] Projeto de teste", client: "Cliente de teste", status: "ativo", created_at: now, updated_at: now })
    .select()
    .single();

  writeFileSync(FIXTURE_PATH, JSON.stringify({ memberId, viewerId, projectId: project!.id }, null, 2));
}
