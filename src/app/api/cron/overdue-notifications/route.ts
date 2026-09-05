import { NextResponse } from "next/server";
import { createDailyOverdueNotifications } from "@/lib/storage";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const processed = await createDailyOverdueNotifications(date);
  return NextResponse.json({ ok: true, date, processed });
}
