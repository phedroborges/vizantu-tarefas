import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, podeAbrirProjeto, requireUser } from "@/lib/authz";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { sendWhatsappText, whatsappConfigured } from "@/lib/whatsapp/provider";
import { getAutomationSettings, getProjectCommunication, saveProjectCommunication } from "@/lib/whatsapp/queue";

// Comunicação do cliente: o grupo de WhatsApp dele e o prazo de aprovação.

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  return NextResponse.json({ communication: await getProjectCommunication(id), configured: whatsappConfigured() }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  const body = await request.json();
  try {
    const communication = await saveProjectCommunication(id, {
      whatsappGroupId: typeof body.whatsappGroupId === "string" ? body.whatsappGroupId : undefined,
      whatsappGroupName: typeof body.whatsappGroupName === "string" ? body.whatsappGroupName : undefined,
      notifyEnabled: typeof body.notifyEnabled === "boolean" ? body.notifyEnabled : undefined,
      approvalDeadlineDays: typeof body.approvalDeadlineDays === "number" ? body.approvalDeadlineDays : undefined,
    });
    return NextResponse.json({ communication });
  } catch (error) {
    return apiFailure(error, "salvar a comunicação do cliente");
  }
}

// Mensagem de teste: confirma que o grupo escolhido é o certo antes de
// qualquer aviso de verdade sair para o cliente.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!podeAbrirProjeto(auth, id)) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  if (!whatsappConfigured()) return NextResponse.json({ error: "O WhatsApp ainda não está configurado no servidor." }, { status: 409 });
  if ((await getAutomationSettings()).paused) return NextResponse.json({ error: "Os envios do WhatsApp estão pausados pela parada de emergência." }, { status: 409 });
  const { whatsappGroupId } = await getProjectCommunication(id);
  if (!whatsappGroupId) return NextResponse.json({ error: "Escolha o grupo do cliente antes de testar." }, { status: 400 });
  try {
    await sendWhatsappText(whatsappGroupId, "Mensagem de teste da Vizantu: os avisos de aprovação deste cliente chegam por aqui.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure(error, "enviar a mensagem de teste");
  }
}
