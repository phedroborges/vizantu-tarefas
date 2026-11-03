import { getProject, unwrap } from "./storage";
import { getSupabase } from "./supabase-client";
import type { ClientLink, Project } from "./types";

// ---------- Link mágico do cliente ----------
//
// O link pendura no PROJETO (o projeto já É a conta do cliente; não existe
// entidade "cliente" separada). É um por projeto, e o banco cobra isso (índice
// client_links_one_active_per_project).

type ClientLinkRow = {
  id: string;
  project_id: string;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function mapClientLink(row: ClientLinkRow): ClientLink {
  return {
    id: row.id,
    projectId: row.project_id,
    token: row.token,
    expiresAt: row.expires_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    lastUsedAt: row.last_used_at ?? undefined,
    createdAt: row.created_at,
  };
}

// A mesma regra vale na porta (/c/[token]) e em cada requisição da sessão.
export function linkAtivo(row: Pick<ClientLinkRow, "revoked_at" | "expires_at">, now = Date.now()): boolean {
  return !row.revoked_at && (!row.expires_at || new Date(row.expires_at).getTime() > now);
}

export async function listClientLinks(projectId: string): Promise<ClientLink[]> {
  const rows = unwrap(await getSupabase().from("client_links").select("*").eq("project_id", projectId).order("created_at", { ascending: false }));
  return (rows as ClientLinkRow[]).map(mapClientLink);
}

// O link do cliente é PERSISTENTE: o mesmo endereço fica com o cliente por
// meses. Gerar um token novo a cada clique em "gerar link" deixava vários
// tokens válidos por projeto e ninguém sabia qual tinha sido enviado — então o
// caminho normal é reaproveitar o link ativo mais recente. Rotacionar (revogar
// o antigo e emitir outro) é chamar createClientLink.
export async function getOrCreateClientLink(projectId: string): Promise<ClientLink> {
  const rows = unwrap(await getSupabase().from("client_links").select("*").eq("project_id", projectId).order("created_at", { ascending: false })) as ClientLinkRow[];
  const active = rows.find((row) => linkAtivo(row));
  return active ? mapClientLink(active) : createClientLink(projectId);
}

// Emitir um endereço novo revoga o anterior. A identidade de quem aprova não
// vem do link — o cliente se identifica na hora da aprovação —, então dois
// endereços vivos só servem pra ninguém saber qual foi o enviado.
export async function createClientLink(projectId: string, expiresAt?: string): Promise<ClientLink> {
  const db = getSupabase();
  const now = new Date().toISOString();
  unwrap(await db.from("client_links").update({ revoked_at: now }).eq("project_id", projectId).is("revoked_at", null));
  const row = unwrap(
    await db
      .from("client_links")
      .insert({ id: crypto.randomUUID(), project_id: projectId, token: randomToken(), expires_at: expiresAt || null, created_at: now })
      .select()
      .single(),
  );
  return mapClientLink(row as ClientLinkRow);
}

export async function revokeClientLink(projectId: string, id: string): Promise<void> {
  unwrap(await getSupabase().from("client_links").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("project_id", projectId));
}

// Resolve o token pro link e o PROJETO dono dele, validando revogação e
// expiração — usado pela rota pública /c/[token].
export async function resolveClientLink(token: string): Promise<{ linkId: string; project: Project } | undefined> {
  const row = unwrap(await getSupabase().from("client_links").select("*").eq("token", token).maybeSingle()) as ClientLinkRow | null;
  if (!row || !linkAtivo(row)) return undefined;
  unwrap(await getSupabase().from("client_links").update({ last_used_at: new Date().toISOString() }).eq("id", row.id));
  const project = await getProject(row.project_id);
  return project ? { linkId: row.id, project } : undefined;
}

/** O projeto de uma sessão aberta pelo link, se o link ainda vale. */
export async function projectOfActiveLink(linkId: string): Promise<string | null> {
  const row = unwrap(await getSupabase().from("client_links").select("project_id, revoked_at, expires_at").eq("id", linkId).maybeSingle()) as Pick<ClientLinkRow, "project_id" | "revoked_at" | "expires_at"> | null;
  return row && linkAtivo(row) ? row.project_id : null;
}

/** Quando o link de cada cliente foi aberto pela última vez. */
export async function listClientLinkAccess(): Promise<{ projectId: string; lastUsedAt?: string }[]> {
  const rows = unwrap(await getSupabase().from("client_links").select("project_id,last_used_at")) as Pick<ClientLinkRow, "project_id" | "last_used_at">[];
  return rows.map((row) => ({ projectId: row.project_id, lastUsedAt: row.last_used_at ?? undefined }));
}
