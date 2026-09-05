import { NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { markNotificationRead } from "@/lib/storage";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const { id } = await params;
  return NextResponse.json({ ok: await markNotificationRead(id, auth.id) });
}
