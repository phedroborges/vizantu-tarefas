import { cache } from "react";
import { createClient } from "./supabase/server-client";
import { getSupabase } from "./supabase-client";
import { projetosDoMembro, veTodosOsProjetos } from "./permissions";
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

  const role = member.role as UserRole;
  let accessibleProjectIds: string[] | "all" = "all";
  let accessibleListKinds: TaskListKind[] | "all" = "all";
  if (!veTodosOsProjetos(role)) {
    const [{ data: equipes }, { data: projetos }, { data: listGrants }] = await Promise.all([
      db.from("project_access").select("project_id, member_id"),
      db.from("projects").select("id"),
      db.from("member_list_access").select("list_kind").eq("member_id", user.id),
    ]);
    accessibleProjectIds = projetosDoMembro(
      user.id,
      (equipes ?? []).map((linha) => ({ projectId: linha.project_id, memberId: linha.member_id })),
      (projetos ?? []).map((projeto) => projeto.id),
    );
    // Mesma lógica para as listas: sem restrição gravada, enxerga as duas.
    const listas = (listGrants ?? []).map((g) => g.list_kind as TaskListKind);
    accessibleListKinds = listas.length ? listas : "all";
  }

  return {
    id: member.id,
    name: member.name,
    email: member.email ?? user.email ?? "",
    role,
    aiEnabled: member.ai_enabled,
    active: member.active,
    accessibleProjectIds,
    accessibleListKinds,
  };
});
