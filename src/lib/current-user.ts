import { cache } from "react";
import { createClient } from "./supabase/server-client";
import { getSupabase } from "./supabase-client";
import type { UserRole } from "./types";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  aiEnabled: boolean;
  active: boolean;
  accessibleProjectIds: string[] | "all";
};

// cache() deduplica dentro de UMA requisição — chamar getCurrentUser() várias
// vezes na mesma página/rota custa 1 round-trip de auth + 1 query em members,
// não N (o cache do React vale tanto pra Server Components quanto Route
// Handlers no Next.js).
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getSupabase();
  const { data: member } = await db.from("members").select("id, name, email, role, active, ai_enabled").eq("id", user.id).maybeSingle();
  if (!member || !member.active) return null; // conta desativada = tratada como deslogada

  let accessibleProjectIds: string[] | "all" = "all";
  if (member.role === "visualizador") {
    const { data: grants } = await db.from("project_access").select("project_id").eq("member_id", user.id);
    accessibleProjectIds = (grants ?? []).map((g) => g.project_id);
  }

  return {
    id: member.id,
    name: member.name,
    email: member.email ?? user.email ?? "",
    role: member.role as UserRole,
    aiEnabled: member.ai_enabled,
    active: member.active,
    accessibleProjectIds,
  };
});
