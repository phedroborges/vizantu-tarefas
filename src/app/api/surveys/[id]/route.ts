import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { deleteSurvey, getSurvey, updateSurvey } from "@/lib/storage";
import type { SurveyQuestionType } from "@/lib/types";

const TYPES = new Set<SurveyQuestionType>(["short_text", "long_text", "single_choice", "multiple_choice", "scale", "nps"]);

async function allowed(id: string, auth: Awaited<ReturnType<typeof requireUser>>) {
  if (isResponse(auth)) return false;
  const survey = await getSurvey(id);
  return Boolean(survey && (auth.accessibleProjectIds === "all" || auth.accessibleProjectIds.includes(survey.projectId)));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!(await allowed(id, auth))) return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  const body = await request.json();
  if (body.questions && (!Array.isArray(body.questions) || body.questions.some((q: { title?: string; type?: SurveyQuestionType }) => !q.title?.trim() || !q.type || !TYPES.has(q.type)))) return NextResponse.json({ error: "Revise as perguntas da pesquisa." }, { status: 400 });
  try {
    const survey = await updateSurvey(id, { title: body.title, description: body.description, status: body.status, questions: body.questions });
    return NextResponse.json({ survey });
  } catch (error) { return apiFailure(error, "salvar a pesquisa"); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const { id } = await params;
  if (!(await allowed(id, auth))) return NextResponse.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  try { await deleteSurvey(id); return NextResponse.json({ ok: true }); }
  catch (error) { return apiFailure(error, "excluir a pesquisa"); }
}
