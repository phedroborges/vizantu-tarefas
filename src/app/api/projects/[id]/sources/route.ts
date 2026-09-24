import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { createProjectSource, deleteProjectSource, listProjectSources } from "@/lib/storage";
import { PROJECT_SOURCE_KINDS } from "@/lib/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    return NextResponse.json({ sources: await listProjectSources(id) });
  } catch (error) {
    return apiFailure(error, "listar as fontes do guia");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();

  if (!body?.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Dê um nome para essa fonte." }, { status: 400 });
  }
  if (!body?.content || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "Cole o conteúdo da reunião ou da anotação." }, { status: 400 });
  }
  if (body.kind !== undefined && !PROJECT_SOURCE_KINDS.some((kind) => kind.value === body.kind)) {
    return NextResponse.json({ error: "Tipo de fonte inválido." }, { status: 400 });
  }

  try {
    const source = await createProjectSource({
      projectId: id,
      title: body.title,
      kind: body.kind,
      content: body.content,
      happenedOn: body.happenedOn,
      createdBy: auth.id,
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    return apiFailure(error, "salvar a fonte do guia");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const sourceId = request.nextUrl.searchParams.get("sourceId");
  if (!sourceId) return NextResponse.json({ error: "Informe a fonte." }, { status: 400 });
  try {
    await deleteProjectSource(sourceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure(error, "remover a fonte do guia");
  }
}
