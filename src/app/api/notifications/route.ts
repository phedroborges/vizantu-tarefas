import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { countUnreadNotifications, listNotificationsForMember, markAllNotificationsRead } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const limit = request.nextUrl.searchParams.get("preview") === "1" ? 6 : 100;
  const [notifications, unread] = await Promise.all([
    listNotificationsForMember(auth.id, limit), countUnreadNotifications(auth.id),
  ]);
  return NextResponse.json({ notifications, unread });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const body = await request.json().catch(() => ({}));
  if (body?.all === true) await markAllNotificationsRead(auth.id);
  return NextResponse.json({ ok: true });
}
