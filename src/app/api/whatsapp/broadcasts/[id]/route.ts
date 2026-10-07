import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_DE_GESTAO } from "@/lib/permissions";
import { cancelBroadcast } from "@/lib/whatsapp/service";

// Cancela o que ainda não saiu. O que já foi enviado não volta.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    return NextResponse.json({ stopped: await cancelBroadcast(id) });
  } catch (error) {
    return apiFailure(error, "cancelar o comunicado");
  }
}
