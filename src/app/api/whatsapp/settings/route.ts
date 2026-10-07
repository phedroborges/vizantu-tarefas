import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_DE_GESTAO } from "@/lib/permissions";
import { whatsappConfigured } from "@/lib/whatsapp/provider";
import { getAutomationSettings, saveAutomationSettings } from "@/lib/whatsapp/queue";

// As mensagens automáticas: ligadas ou não, a que horas saem e o que dizem.

export async function GET() {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  try {
    return NextResponse.json({ configured: whatsappConfigured(), settings: await getAutomationSettings() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "carregar as mensagens automáticas");
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  try {
    return NextResponse.json({ settings: await saveAutomationSettings(await request.json()) });
  } catch (error) {
    return apiFailure(error, "salvar as mensagens automáticas");
  }
}
