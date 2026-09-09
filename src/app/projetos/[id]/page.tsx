import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ProjectProfileView } from "@/components/project-profile-view";
import { requirePageAccess } from "@/lib/page-guard";
import { abasDoProjeto, podeGerenciarCredenciais, podePlanejar, podeVerCredenciais } from "@/lib/permissions";
import { filterTasksByListAccess } from "@/lib/authz";
import { secretsAvailable } from "@/lib/crypto-secrets";
import { getProject, getProjectProfile, listContracts, listMembers, listPlans, listProjectCredentials, listProjectTeam, listSatisfactionScores, listSurveys, listTags, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess("projetos");
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  if (user.accessibleProjectIds !== "all" && !user.accessibleProjectIds.includes(id)) notFound();

  // Quem não pode ver recebe a lista VAZIA do servidor — não é a tela que
  // esconde, é o dado que não sai daqui. O mesmo vale para o contrato.
  const abas = abasDoProjeto(user.role);
  const veCredenciais = podeVerCredenciais(user.role);
  const veContratos = abas.includes("documentos");
  const [profile, credentials, allTasks, satisfactionScores, formatTags, channelTags, members, plans, surveys, team, allContracts] = await Promise.all([
    getProjectProfile(id),
    veCredenciais ? listProjectCredentials(id) : Promise.resolve([]),
    listTasks(),
    listSatisfactionScores(id),
    listTags("formato"),
    listTags("canal"),
    listMembers(),
    listPlans(id),
    listSurveys(id),
    abas.includes("equipe") ? listProjectTeam(id) : Promise.resolve([]),
    veContratos ? listContracts() : Promise.resolve([]),
  ]);

  return (
    <AdminShell active="projetos" user={user}>
      <ProjectProfileView
        project={project}
        initialProfile={profile ?? null}
        initialCredentials={credentials}
        canViewCredentials={veCredenciais}
        canManageCredentials={podeGerenciarCredenciais(user.role)}
        secretsConfigured={secretsAvailable()}
        initialTasks={filterTasksByListAccess(allTasks.filter((task) => task.projectId === id), user.accessibleListKinds)}
        satisfactionScores={satisfactionScores}
        canEditProfile={podePlanejar(user.role)}
        canEditTasks
        abas={abas}
        initialTeam={team}
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
