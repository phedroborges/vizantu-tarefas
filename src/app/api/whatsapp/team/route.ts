import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_DE_GESTAO } from "@/lib/permissions";
import { normalizeTeamNotices } from "@/lib/whatsapp/messages";
import { getAutomationSettings, saveAutomationSettings } from "@/lib/whatsapp/queue";
import { TeamNoticeError, buildTeamNotices, sendTeamNoticesNow } from "@/lib/whatsapp/team";

// Os avisos internos, para o grupo do time: o que está atrasado, o que está
// sem informação e quem é o mais rápido.

/** A prévia: os avisos que sairiam agora, com os dados reais de hoje. */
export async function GET() {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  try {
    const notices = await buildTeamNotices(new Date(), { always: true });
    return NextResponse.json({ notices: notices.map(({ type, title, body }) => ({ type, title, body })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "montar a prévia dos avisos da equipe");
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  try {
    const team = normalizeTeamNotices(await request.json());
    if (team.enabled && !team.groupId) return NextResponse.json({ error: "Escolha o grupo da equipe antes de ligar os avisos." }, { status: 400 });
    const settings = await saveAutomationSettings({ ...(await getAutomationSettings()), team });
    return NextResponse.json({ team: settings.team });
  } catch (error) {
    return apiFailure(error, "salvar os avisos da equipe");
  }
}

/** Enviar agora: coloca os avisos do momento na fila. */
export async function POST() {
  const auth = await requireUser(ROLES_DE_GESTAO);
  if (isResponse(auth)) return auth;
  try {
    return NextResponse.json({ queued: await sendTeamNoticesNow() });
  } catch (error) {
    if (error instanceof TeamNoticeError) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiFailure(error, "enviar os avisos da equipe");
  }
}
