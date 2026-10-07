import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_DE_GESTAO } from "@/lib/permissions";
import { whatsappConfigured } from "@/lib/whatsapp/provider";
import { getAutomationSettings, saveAutomationSettings } from "@/lib/whatsapp/queue";
import { countPendingMessages } from "@/lib/whatsapp/service";

// As mensagens automáticas: ligadas ou não, a que horas saem e o que dizem.

export async function GET() {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  try {
    return NextResponse.json({ configured: whatsappConfigured(), settings: await getAutomationSettings(), pending: await countPendingMessages() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "carregar as mensagens automáticas");
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  try {
    // A parada de emergência tem a própria rota (PATCH): salvar os textos não
    // pode religar nem pausar os envios por tabela.
    const { paused } = await getAutomationSettings();
    return NextResponse.json({ settings: await saveAutomationSettings({ ...(await request.json()), paused }) });
  } catch (error) {
    return apiFailure(error, "salvar as mensagens automáticas");
  }
}

// Parada de emergência: pausa ou retoma todos os envios, na hora.
export async function PATCH(request: NextRequest) {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  try {
    const body = await request.json();
    const settings = await saveAutomationSettings({ ...(await getAutomationSettings()), paused: body.paused === true });
    return NextResponse.json({ settings, pending: await countPendingMessages() });
  } catch (error) {
    return apiFailure(error, "alterar a parada de emergência");
  }
}
