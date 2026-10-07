import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_DE_GESTAO } from "@/lib/permissions";
import { whatsappConfigured } from "@/lib/whatsapp/provider";
import { BroadcastError, createBroadcast, listBroadcasts } from "@/lib/whatsapp/service";

// Comunicado para vários clientes de uma vez. Só gestão: é a voz da empresa
// falando nos grupos de todos os clientes.

export async function GET() {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  try {
    return NextResponse.json({ configured: whatsappConfigured(), broadcasts: await listBroadcasts() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "carregar os comunicados");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  const projectIds = Array.isArray(body.projectIds) ? body.projectIds.filter((id: unknown): id is string => typeof id === "string") : [];
  const variations = Array.isArray(body.variations) ? body.variations.filter((text: unknown): text is string => typeof text === "string") : [];
  if (!projectIds.length) return NextResponse.json({ error: "Escolha pelo menos um cliente." }, { status: 400 });
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "";
  const mediaType = body.mediaType === "video" || body.mediaType === "document" ? body.mediaType : "image";
  if (mediaUrl && !/^https:\/\//i.test(mediaUrl)) return NextResponse.json({ error: "O link da mídia precisa começar com https://." }, { status: 400 });
  try {
    const result = await createBroadcast({
      title: typeof body.title === "string" ? body.title : "",
      variations,
      media: mediaUrl ? { url: mediaUrl, type: mediaType } : undefined,
      projectIds,
      intervalSeconds: typeof body.intervalSeconds === "number" ? body.intervalSeconds : 90,
      createdBy: auth.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof BroadcastError) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiFailure(error, "enviar o comunicado");
  }
}
