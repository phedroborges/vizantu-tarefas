import { notFound } from "next/navigation";
import { PublicSurvey } from "@/components/public-survey";
import { getProject, getSurveyByToken } from "@/lib/storage";

export const dynamic = "force-dynamic";
export default async function PublicSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const survey = await getSurveyByToken(token);
  if (!survey || survey.status !== "published") notFound();
  const project = await getProject(survey.projectId); if (!project) notFound();
  return <PublicSurvey survey={{ ...survey, responses: [] }} projectName={project.name} />;
}
