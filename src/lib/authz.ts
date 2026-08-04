import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./current-user";
import type { UserRole } from "./types";

// Devolve o usuário atual (autenticado e, se `roles` foi passado, autorizado)
// ou já devolve a NextResponse de erro certa. Cada rota faz uma chamada,
// checa com isResponse() e retorna cedo — sem decorator, sem indireção.
export async function requireUser(roles?: UserRole[]): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (roles && !roles.includes(user.role)) {
    return NextResponse.json({ error: "Você não tem permissão para fazer isso." }, { status: 403 });
  }
  return user;
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

// Usado pelas rotas de listagem (tasks/projects) — filtra pelo acesso do
// usuário quando ele for "visualizador"; dono/editor recebem tudo.
export function filterByAccess<T extends { id: string }>(items: T[], accessibleProjectIds: string[] | "all"): T[] {
  if (accessibleProjectIds === "all") return items;
  const allowed = new Set(accessibleProjectIds);
  return items.filter((item) => allowed.has(item.id));
}

export function filterTasksByAccess<T extends { projectId: string }>(tasks: T[], accessibleProjectIds: string[] | "all"): T[] {
  if (accessibleProjectIds === "all") return tasks;
  const allowed = new Set(accessibleProjectIds);
  return tasks.filter((task) => allowed.has(task.projectId));
}
