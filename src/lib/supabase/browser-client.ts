"use client";

import { createBrowserClient } from "@supabase/ssr";

// Usado pelas páginas de login/esqueci-senha/nova-senha e pelo botão de sair
// — as únicas partes do app que falam com o Supabase Auth direto do
// navegador. Todo o resto (tarefas, projetos etc.) continua passando pelas
// rotas /api do servidor, como sempre.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
