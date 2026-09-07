import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { SurveyManager } from "@/components/survey-manager";
import { getCurrentUser } from "@/lib/current-user";
import { listProjects, listSurveys } from "@/lib/storage";

export const dynamic = "force-dynamic";
export default async function PesquisasPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  const [projects, allSurveys] = await Promise.all([listProjects(), listSurveys()]);
  const allowedProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((project) => user.accessibleProjectIds.includes(project.id));
  const surveys = user.accessibleProjectIds === "all" ? allSurveys : allSurveys.filter((survey) => user.accessibleProjectIds.includes(survey.projectId));
  return <AdminShell active="pesquisas" user={user}><main className="admin-page"><div className="dashboard-head"><div><span className="vz-eyebrow">Relacionamento</span><h1>Pesquisas</h1><p>Crie formulários por cliente, publique links e acompanhe respostas e NPS.</p></div></div><SurveyManager initialSurveys={surveys} projects={allowedProjects} /></main></AdminShell>;
}
