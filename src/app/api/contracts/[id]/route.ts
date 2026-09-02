import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { deleteContract, updateContract } from "@/lib/storage";
import { CONTRACT_STATUSES } from "@/lib/types";

const ROLES = ["dono"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser([...ROLES]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();

  if (body.status !== undefined && !CONTRACT_STATUSES.some((status) => status.value === body.status)) {
    return NextResponse.json({ error: "Situação de contrato inválida." }, { status: 400 });
  }

  try {
    const contract = await updateContract(id, {
      title: body.title,
      status: body.status,
      fields: body.fields,
      body: body.body,
      paymentMode: body.paymentMode,
      projectId: body.projectId,
    });
    if (!contract) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
    return NextResponse.json({ contract });
  } catch (error) {
    return apiFailure(error, "salvar o contrato");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser([...ROLES]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  try {
    const removed = await deleteContract(id);
    if (!removed) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure(error, "excluir o contrato");
  }
}
