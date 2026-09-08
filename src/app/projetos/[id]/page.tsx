import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ProjectProfileView } from "@/components/project-profile-view";
import { getCurrentUser } from "@/lib/current-user";
import { filterTasksByListAccess } from "@/lib/authz";
import { secretsAvailable } from "@/lib/crypto-secrets";
import { getProject, getProjectProfile, listContracts, listMembers, listPlans, listProjectCredentials, listSatisfactionScores, listSurveys, listTags, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  if (user.accessibleProjectIds !== "all" && !user.accessibleProjectIds.includes(id)) notFound();

  // Credencial é do dono. Quem não é dono recebe a lista vazia do servidor —
  // não é a tela que esconde, é o dado que não sai daqui.
  const isOwner = user.role === "dono";
  const [profile, credentials, allTasks, satisfactionScores, formatTags, channelTags, members, plans, surveys, allContracts] = await Promise.all([
    getProjectProfile(id),
    isOwner ? listProjectCredentials(id) : Promise.resolve([]),
    listTasks(),
    listSatisfactionScores(id),
    listTags("formato"),
    listTags("canal"),
    listMembers(),
    listPlans(id),
    listSurveys(id),
    listContracts(),
  ]);

  return (
    <AdminShell active="projetos" user={user}>
      <ProjectProfileView
        project={project}
        initialProfile={profile ?? null}
        initialCredentials={credentials}
        canManageCredentials={isOwner}
        secretsConfigured={secretsAvailable()}
        initialTasks={filterTasksByListAccess(allTasks.filter((task) => task.projectId === id), user.accessibleListKinds)}
        satisfactionScores={satisfactionScores}
        canEditProfile={user.role !== "visualizador"}
        formatTags={formatTags}
        channelTags={channelTags}
        members={members}
        initialPlans={plans}
        initialSurveys={surveys}
        initialContracts={allContracts.filter((contract) => contract.projectId === id)}
      />
    </AdminShell>
  );
}
