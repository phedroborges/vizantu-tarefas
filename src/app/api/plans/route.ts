import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { createPlan, listPlans } from "@/lib/storage";
import { PLAN_KINDS } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const projectId = new URL(request.url).searchParams.get("projectId") || undefined;
  const plans = await listPlans(projectId);
  const visible = auth.accessibleProjectIds === "all" ? plans : plans.filter((p) => (auth.accessibleProjectIds as string[]).includes(p.projectId));
  return NextResponse.json({ plans: visible });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body?.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Informe o título do plano." }, { status: 400 });
  }
  if (!body?.projectId || typeof body.projectId !== "string") {
    return NextResponse.json({ error: "Selecione um projeto." }, { status: 400 });
  }
  if (!PLAN_KINDS.some((k) => k.value === body.kind)) {
    return NextResponse.json({ error: "Selecione o tipo do plano." }, { status: 400 });
  }
  const plan = await createPlan({
    projectId: body.projectId,
    title: body.title,
    kind: body.kind,
    approvalDeadline: body.approvalDeadline,
    approvalPeriodDays: body.approvalPeriodDays,
    createdBy: auth.id,
  });
  return NextResponse.json({ plan }, { status: 201 });
}
