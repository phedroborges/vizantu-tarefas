import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/api-error";
import { getSurveyByToken, submitSurveyResponse } from "@/lib/storage";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const survey = await getSurveyByToken(token);
  if (!survey || survey.status !== "published") return NextResponse.json({ error: "Pesquisa indisponível." }, { status: 404 });
  return NextResponse.json({ survey: { ...survey, responses: [] } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const survey = await getSurveyByToken(token);
  if (!survey || survey.status !== "published") return NextResponse.json({ error: "Pesquisa indisponível." }, { status: 404 });
  const body = await request.json();
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const missing = survey.questions.filter((question) => question.required && !answers.some((answer: { questionId: string; value: unknown }) => answer.questionId === question.id && answer.value !== "" && (!Array.isArray(answer.value) || answer.value.length)));
  if (missing.length) return NextResponse.json({ error: "Responda todas as perguntas obrigatórias." }, { status: 400 });
  try {
    const result = await submitSurveyResponse(token, { respondentName: body.respondentName, answers });
    return NextResponse.json({ ok: Boolean(result) });
  } catch (error) { return apiFailure(error, "enviar a resposta"); }
}
