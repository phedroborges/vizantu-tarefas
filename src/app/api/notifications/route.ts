import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { listNotificationsForMember, markAllNotificationsRead } from "@/lib/storage";

export async function GET() {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const notifications = await listNotificationsForMember(auth.id);
  return NextResponse.json({ notifications, unread: notifications.filter((item) => !item.readAt).length });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const body = await request.json().catch(() => ({}));
  if (body?.all === true) await markAllNotificationsRead(auth.id);
  return NextResponse.json({ ok: true });
}
