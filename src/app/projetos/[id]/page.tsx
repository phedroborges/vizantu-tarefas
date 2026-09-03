import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ProjectProfileView } from "@/components/project-profile-view";
import { getCurrentUser } from "@/lib/current-user";
import { secretsAvailable } from "@/lib/crypto-secrets";
import { getProject, getProjectProfile, listProjectCredentials } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "visualizador") redirect("/projetos");

  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  // Credencial é do dono. Quem não é dono recebe a lista vazia do servidor —
  // não é a tela que esconde, é o dado que não sai daqui.
  const isOwner = user.role === "dono";
  const [profile, credentials] = await Promise.all([
    getProjectProfile(id),
    isOwner ? listProjectCredentials(id) : Promise.resolve([]),
  ]);

  return (
    <AdminShell active="projetos" user={user}>
      <ProjectProfileView
        project={project}
        initialProfile={profile ?? null}
        initialCredentials={credentials}
        canManageCredentials={isOwner}
        secretsConfigured={secretsAvailable()}
      />
    </AdminShell>
  );
}
