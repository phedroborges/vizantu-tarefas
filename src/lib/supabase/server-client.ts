import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Serve tanto Server Components quanto Route Handlers — ambos suportam
// `await cookies()` de next/headers. A diferença é que Server Components não
// podem escrever cookie (o set() abaixo lança ali dentro); isso é inofensivo
// porque o proxy.ts já renova o cookie de sessão a cada navegação.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de um Server Component (só leitura) — sem problema.
        }
      },
    },
  });
}
