import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { buildContractBody, defaultStructure, PAYMENT_STRUCTURES, type ContractTemplateId, type PaymentMode, type PaymentStructure } from "@/lib/contract-templates";
import { createContract, listContracts } from "@/lib/storage";

// Contrato tem valor, CNPJ e condição comercial. Fica com o dono, não com
// todo mundo que edita tarefa.
const ROLES = ["dono"] as const;

const TEMPLATES: ContractTemplateId[] = ["gestao_marca", "criacao_marca", "branco"];

export async function GET() {
  const auth = await requireUser([...ROLES]);
  if (isResponse(auth)) return auth;
  return NextResponse.json({ contracts: await listContracts() });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser([...ROLES]);
  if (isResponse(auth)) return auth;
  const body = await request.json();

  if (!body?.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Informe o nome do contrato." }, { status: 400 });
  }
  const templateId = body.templateId as ContractTemplateId;
  if (!TEMPLATES.includes(templateId)) {
    return NextResponse.json({ error: "Escolha um modelo de contrato." }, { status: 400 });
  }
  const paymentMode: PaymentMode = body.paymentMode === "pos" ? "pos" : "pre";
  const paymentStructure: PaymentStructure = PAYMENT_STRUCTURES.some((s) => s.id === body.paymentStructure)
    ? body.paymentStructure
    : defaultStructure(templateId);

  try {
    // O texto do modelo é COPIADO agora. A partir daqui este contrato é um
    // documento próprio, e melhorar o modelo depois não mexe nele.
    const contract = await createContract({
      title: body.title,
      templateId,
      paymentMode,
      paymentStructure,
      body: buildContractBody(templateId, paymentMode, paymentStructure),
      fields: typeof body.fields === "object" && body.fields ? body.fields : {},
      projectId: body.projectId || null,
      createdBy: auth.id,
    });
    return NextResponse.json({ contract }, { status: 201 });
  } catch (error) {
    return apiFailure(error, "criar o contrato");
  }
}
