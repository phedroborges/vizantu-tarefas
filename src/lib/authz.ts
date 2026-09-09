import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./current-user";
import type { TaskListKind, UserRole } from "./types";

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

// Enquanto só o dono lia credencial, nenhuma rota precisava perguntar de QUAL
// cliente ela era — ele vê todos. Com o social media entrando, o cargo deixou
// de ser resposta suficiente: ele só pode abrir a senha de um cliente de que
// faz parte.
export function podeAbrirProjeto(user: CurrentUser, projectId: string): boolean {
  return user.accessibleProjectIds === "all" || user.accessibleProjectIds.includes(projectId);
}

// Usado pelas rotas de listagem (tasks/projects) — filtra pelos clientes de
// que a pessoa faz parte; dono e gestor recebem "all" e passam direto.
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

// Tarefa sem lista marcada não pertence a nenhuma lista específica — continua
// visível pra todo mundo. Uma tarefa em ambas as listas (interna + externa)
// só some pra quem não tem acesso a NENHUMA das duas em que ela está.
export function filterTasksByListAccess<T extends { lists: TaskListKind[] }>(tasks: T[], accessibleListKinds: TaskListKind[] | "all"): T[] {
  if (accessibleListKinds === "all") return tasks;
  const allowed = new Set(accessibleListKinds);
  return tasks.filter((task) => task.lists.length === 0 || task.lists.some((kind) => allowed.has(kind)));
}
