import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createClientLink, listClientLinks, revokeClientLink } from "@/lib/storage";

// Link de acesso do cliente ao painel — um por projeto. O projeto já É a
// conta do cliente, então o link pendura aqui e não numa entidade paralela.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  return NextResponse.json({ links: await listClientLinks(id) });
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  return NextResponse.json({ link: await createClientLink(id) }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  await params;
  const linkId = new URL(request.url).searchParams.get("linkId");
  if (!linkId) return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  await revokeClientLink(linkId);
  return NextResponse.json({ ok: true });
}
