import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createPlanCaptacao } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body?.planId || typeof body.planId !== "string") {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }
  if (!body?.label || typeof body.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "Informe o nome da captação." }, { status: 400 });
  }
  const captacao = await createPlanCaptacao({ planId: body.planId, label: body.label, sequenceOrder: body.sequenceOrder });
  return NextResponse.json({ captacao }, { status: 201 });
}
