import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { buildPaymentClause, PAYMENT_STRUCTURES, replacePaymentClause, type ContractTemplateId, type PaymentMode, type PaymentStructure } from "@/lib/contract-templates";
import { deleteContract, getContract, updateContract } from "@/lib/storage";
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

  if (body.paymentStructure !== undefined && !PAYMENT_STRUCTURES.some((s) => s.id === body.paymentStructure)) {
    return NextResponse.json({ error: "Estrutura de pagamento inválida." }, { status: 400 });
  }

  try {
    // Trocar a estrutura (ou o pré/pós) reescreve SÓ a cláusula 3. É a única
    // parte do documento que depende dessa escolha, e reconstruir o contrato
    // inteiro apagaria qualquer ajuste feito nas outras cláusulas.
    let novoCorpo: string | undefined = body.body;
    const mudouPagamento = body.paymentStructure !== undefined || body.paymentMode !== undefined;
    if (mudouPagamento && body.body === undefined) {
      const atual = await getContract(id);
      if (atual) {
        const structure = (body.paymentStructure ?? atual.paymentStructure) as PaymentStructure;
        const mode = (body.paymentMode ?? atual.paymentMode) as PaymentMode;
        novoCorpo = replacePaymentClause(atual.body, buildPaymentClause(atual.templateId as ContractTemplateId, structure, mode));
      }
    }

    const contract = await updateContract(id, {
      title: body.title,
      status: body.status,
      fields: body.fields,
      body: novoCorpo,
      paymentMode: body.paymentMode,
      paymentStructure: body.paymentStructure,
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
