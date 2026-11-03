import { NextRequest, NextResponse } from "next/server";
import { isResponse, podeAbrirProjeto, requireUser, semAcesso } from "@/lib/authz";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { createClientLink, getOrCreateClientLink, listClientLinks, revokeClientLink } from "@/lib/client-links";

// Link de acesso do cliente ao painel — um por projeto. O projeto já É a
// conta do cliente, então o link pendura aqui e não numa entidade paralela.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  return NextResponse.json({ links: await listClientLinks(id) });
}

// Idempotente por padrão: devolve o link ativo do projeto, criando um só se
// ainda não existir. `?rotate=1` revoga o atual e emite outro — é o único
// caminho que invalida o endereço que já está com o cliente.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  const rotate = new URL(request.url).searchParams.get("rotate") === "1";
  const link = rotate ? await createClientLink(id) : await getOrCreateClientLink(id);
  return NextResponse.json({ link }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return semAcesso();
  const linkId = new URL(request.url).searchParams.get("linkId");
  if (!linkId) return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  await revokeClientLink(id, linkId);
  return NextResponse.json({ ok: true });
}
