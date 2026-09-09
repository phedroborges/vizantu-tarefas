import { NextResponse } from "next/server";
import { hojeEmSaoPaulo, varrerAtrasos } from "@/lib/overdue-scheduler";

// A varredura de atrasos roda sozinha dentro do servidor (ver
// src/lib/overdue-scheduler.ts). Este endpoint sobrou como gatilho manual —
// para conferir o resultado sem esperar a próxima meia hora, ou para um
// agendador externo, se um dia a instalação tiver um. Só responde com
// CRON_SECRET configurada; sem ela, não existe forma de chamar.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const agora = new Date();
  return NextResponse.json({ ok: true, date: hojeEmSaoPaulo(agora), processed: await varrerAtrasos(agora) });
}
