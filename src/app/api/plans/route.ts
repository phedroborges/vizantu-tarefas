import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { createBrandWorkflow, createPlan, listPlans } from "@/lib/storage";
import { isMonth } from "@/lib/plan-month";
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
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
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
  if (body.periodMonth != null && body.periodMonth !== "" && (!isMonth(body.periodMonth) || body.kind !== "content")) {
    return NextResponse.json({ error: "Plano mensal precisa de um mês válido e do tipo Conteúdo." }, { status: 400 });
  }
  if (body.kind === "brand") {
    const result = await createBrandWorkflow({ projectId: body.projectId, title: body.title, createdBy: auth.id });
    return NextResponse.json(result, { status: 201 });
  }
  try {
    const plan = await createPlan({
      projectId: body.projectId,
      title: body.title,
      kind: body.kind,
      approvalDeadline: body.approvalDeadline,
      approvalPeriodDays: body.approvalPeriodDays,
      periodMonth: body.periodMonth || undefined,
      createdBy: auth.id,
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    // O índice único garante um plano mensal por cliente e mês.
    if (body.periodMonth && /plans_project_period_month_key|duplicate key/i.test(error instanceof Error ? error.message : "")) {
      return NextResponse.json({ error: "Este cliente já tem o plano deste mês." }, { status: 409 });
    }
    throw error;
  }
}
