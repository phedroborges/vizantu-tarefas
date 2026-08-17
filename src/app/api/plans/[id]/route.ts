import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireUser } from "@/lib/authz";
import { deletePlan, getPlan, listPlanCaptacoes, listPlanTasks, updatePlan } from "@/lib/storage";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  const [captacoes, tasks] = await Promise.all([listPlanCaptacoes(id), listPlanTasks(id)]);
  return NextResponse.json({ plan, captacoes, tasks });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();
  const plan = await updatePlan(id, {
    title: body.title,
    status: body.status,
    approvalDeadline: body.approvalDeadline,
    approvalPeriodDays: body.approvalPeriodDays,
  });
  if (!plan) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono", "editor"]);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  const removed = await deletePlan(id);
  if (!removed) return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
