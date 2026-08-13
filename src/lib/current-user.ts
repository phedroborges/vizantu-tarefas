import { cache } from "react";
import { createClient } from "./supabase/server-client";
import { getSupabase } from "./supabase-client";
import type { TaskListKind, UserRole } from "./types";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  aiEnabled: boolean;
  active: boolean;
  accessibleProjectIds: string[] | "all";
  accessibleListKinds: TaskListKind[] | "all";
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
  let accessibleListKinds: TaskListKind[] | "all" = "all";
  if (member.role === "visualizador") {
    const [{ data: projectGrants }, { data: listGrants }] = await Promise.all([
      db.from("project_access").select("project_id").eq("member_id", user.id),
      db.from("member_list_access").select("list_kind").eq("member_id", user.id),
    ]);
    accessibleProjectIds = (projectGrants ?? []).map((g) => g.project_id);
    accessibleListKinds = (listGrants ?? []).map((g) => g.list_kind as TaskListKind);
  }

  return {
    id: member.id,
    name: member.name,
    email: member.email ?? user.email ?? "",
    role: member.role as UserRole,
    aiEnabled: member.ai_enabled,
    active: member.active,
    accessibleProjectIds,
    accessibleListKinds,
  };
});
