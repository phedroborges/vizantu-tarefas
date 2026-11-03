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
    // A parada de emergência e as chaves de aviso e cobrança têm a própria rota
    // (PATCH): salvar os textos não pode religar nem pausar nada por tabela.
    // Os avisos da equipe também (PUT em /api/whatsapp/team): esta tela guarda
    // uma cópia antiga deles e não pode gravar por cima.
    const { paused, enabled, reminders, team } = await getAutomationSettings();
    return NextResponse.json({ settings: await saveAutomationSettings({ ...(await request.json()), paused, enabled, reminders, team }) });
  } catch (error) {
    return apiFailure(error, "salvar as mensagens automáticas");
  }
}

// Chaves que valem na hora: a parada de emergência, o aviso de material para
// aprovar e as cobranças. Só muda a chave que veio no pedido.
export async function PATCH(request: NextRequest) {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  try {
    const body = await request.json();
    const changes = Object.fromEntries((["paused", "enabled", "reminders"] as const).filter((key) => typeof body?.[key] === "boolean").map((key) => [key, body[key]]));
    const settings = await saveAutomationSettings({ ...(await getAutomationSettings()), ...changes });
    return NextResponse.json({ settings, pending: await countPendingMessages() });
  } catch (error) {
    return apiFailure(error, "alterar a parada de emergência");
  }
}
