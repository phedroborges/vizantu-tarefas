import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { listStatusColors, setStatusColors } from "@/lib/storage";
import { TASK_STATUSES } from "@/lib/types";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function GET() {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const colors = await listStatusColors();
  return NextResponse.json({ colors });
}

// POST, e não PUT: em produção nenhuma das 3 rotas PUT do app jamais gravou
// (status_colors, project_access e member_list_access estavam as três vazias),
// enquanto tudo que é POST/PATCH grava normalmente — o método provavelmente
// morre antes de chegar no Next. Não custa nada usar o verbo que funciona.
export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body?.colors || typeof body.colors !== "object") {
    return NextResponse.json({ error: "Envie o mapa de cores." }, { status: 400 });
  }
  for (const [status, color] of Object.entries(body.colors as Record<string, unknown>)) {
    if (!TASK_STATUSES.some((item) => item.value === status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    if (typeof color !== "string" || !HEX_COLOR.test(color)) {
      return NextResponse.json({ error: "Cor inválida — use o formato #RRGGBB." }, { status: 400 });
    }
  }
  const colors = await setStatusColors(body.colors);
  return NextResponse.json({ colors });
}
