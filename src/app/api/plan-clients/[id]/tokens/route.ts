import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createPlanClientToken, listPlanClientTokens } from "@/lib/storage";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const tokens = await listPlanClientTokens(id);
  return NextResponse.json({ tokens });
}

// Emite um novo link mágico pro cliente (token opaco de 32 bytes) — o time
// copia a URL /c/[token] do vizantu-planos e envia pro cliente.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const token = await createPlanClientToken({ clientId: id });
  return NextResponse.json({ token }, { status: 201 });
}
