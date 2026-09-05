import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createAnnouncement, createNotifications, listAnnouncements, listMembers, listPendingAnnouncementsForMember } from "@/lib/storage";
import { ANNOUNCEMENT_SCOPES, USER_ROLES } from "@/lib/types";

// Sem query param -> lista completa (tela de gestão, dono/editor). Com
// ?pending=1 -> só os avisos ainda não confirmados PARA o usuário logado
// (é isso que o AnnouncementGate busca no mount do AdminShell).
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const pending = new URL(request.url).searchParams.get("pending");
  if (pending) {
    const announcements = await listPendingAnnouncementsForMember({ id: auth.id, role: auth.role });
    return NextResponse.json({ announcements });
  }
  if (auth.role !== "dono" && auth.role !== "editor") {
    return NextResponse.json({ error: "Você não tem permissão para fazer isso." }, { status: 403 });
  }
  const announcements = await listAnnouncements();
  return NextResponse.json({ announcements });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body?.body || typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "Escreva o texto do aviso." }, { status: 400 });
  }
  if (!ANNOUNCEMENT_SCOPES.some((s) => s.value === body.scope)) {
    return NextResponse.json({ error: "Escopo inválido." }, { status: 400 });
  }
  // Escopo "all" (avisa todo mundo) é restrito a dono — mesma regra vale
  // pro tool da IA (assistant-tools.ts).
  if (body.scope === "all" && auth.role !== "dono") {
    return NextResponse.json({ error: "Só o dono pode criar um aviso para todos os usuários." }, { status: 403 });
  }
  if (body.scope === "role" && !USER_ROLES.some((r) => r.value === body.scopeRole)) {
    return NextResponse.json({ error: "Selecione a categoria (papel)." }, { status: 400 });
  }
  if (body.scope === "member" && (!body.scopeMemberId || typeof body.scopeMemberId !== "string")) {
    return NextResponse.json({ error: "Selecione o usuário." }, { status: 400 });
  }
  const announcement = await createAnnouncement({
    title: body.title,
    body: body.body,
    createdBy: auth.id,
    scope: body.scope,
    scopeRole: body.scopeRole,
    scopeMemberId: body.scopeMemberId,
    expiresAt: body.expiresAt,
  });
  const members = (await listMembers()).filter((member) => member.active && (
    body.scope === "all" || (body.scope === "role" && member.role === body.scopeRole) || (body.scope === "member" && member.id === body.scopeMemberId)
  ));
  await createNotifications(members.map((member) => ({ recipientMemberId: member.id, actorMemberId: auth.id, type: "announcement", title: announcement.title || "Novo aviso", body: announcement.body, actionUrl: "/notificacoes", dedupeKey: `announcement:${announcement.id}:${member.id}` })));
  return NextResponse.json({ announcement }, { status: 201 });
}
