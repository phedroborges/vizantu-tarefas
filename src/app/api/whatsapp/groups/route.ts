import { NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { listWhatsappGroups, whatsappConfigured } from "@/lib/whatsapp/provider";

// Os grupos em que o número da Vizantu está, para escolher o do cliente.
export async function GET() {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  if (!whatsappConfigured()) return NextResponse.json({ configured: false, groups: [] });
  try {
    return NextResponse.json({ configured: true, groups: await listWhatsappGroups() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error, "buscar os grupos do WhatsApp");
  }
}
