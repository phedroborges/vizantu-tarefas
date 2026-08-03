import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Só roda no servidor (rotas de API / server components) com a service role
// key — nunca exponha essa chave para o navegador. Não há uso de Supabase
// direto no cliente neste app; tudo passa pelas rotas /api existentes.
let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas no ambiente.");
  }
  client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return client;
}

export function getSupabaseStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "vizantu-tarefas-uploads";
}
