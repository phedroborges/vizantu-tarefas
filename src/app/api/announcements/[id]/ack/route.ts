import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { acknowledgeAnnouncement } from "@/lib/storage";

// Único jeito de um aviso sumir da tela do destinatário — sem timeout, sem
// fechar por ESC/clique fora (ver AnnouncementGate no cliente).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const { id } = await params;
  await acknowledgeAnnouncement(id, auth.id);
  return NextResponse.json({ ok: true });
}
