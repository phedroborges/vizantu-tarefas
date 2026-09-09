import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { ROLES_QUE_PLANEJAM } from "@/lib/permissions";
import { SURVEY_TEMPLATES, type SurveyTemplate } from "@/lib/survey-templates";
import { createSurvey, listSurveys } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  const projectId = request.nextUrl.searchParams.get("projectId") || undefined;
  if (projectId && auth.accessibleProjectIds !== "all" && !auth.accessibleProjectIds.includes(projectId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const surveys = await listSurveys(projectId);
  return NextResponse.json({ surveys: auth.accessibleProjectIds === "all" ? surveys : surveys.filter((survey) => auth.accessibleProjectIds.includes(survey.projectId)) });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(ROLES_QUE_PLANEJAM);
  if (isResponse(auth)) return auth;
  const body = await request.json();
  if (!body.projectId || !body.title?.trim()) return NextResponse.json({ error: "Informe o projeto e o título." }, { status: 400 });
  if (auth.accessibleProjectIds !== "all" && !auth.accessibleProjectIds.includes(body.projectId)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  // Só o que createSurvey usa: o corpo vem do cliente e não deve virar payload
  // aberto. Modelo desconhecido cai em pesquisa vazia, nunca em erro.
  const template = SURVEY_TEMPLATES.some((item) => item.value === body.template) ? (body.template as SurveyTemplate) : "blank";
  try { return NextResponse.json({ survey: await createSurvey({ projectId: body.projectId, title: body.title, description: body.description, template }) }, { status: 201 }); }
  catch (error) { return apiFailure(error, "criar a pesquisa"); }
}
