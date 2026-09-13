import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_DO_TIME } from "@/lib/permissions";
import { deleteTag } from "@/lib/storage";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_DO_TIME);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Etiqueta inválida." }, { status: 400 });
  }
  try {
    if (!await deleteTag(id)) return NextResponse.json({ error: "Etiqueta não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure(error, "excluir a etiqueta");
  }
}
