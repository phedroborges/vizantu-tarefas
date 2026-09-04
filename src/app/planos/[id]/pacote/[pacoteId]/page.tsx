import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { PacoteDetailView } from "@/components/pacote-detail-view";
import { getCurrentUser } from "@/lib/current-user";
import { getPlan, getProject, listMembers, listPlanCaptacoes, listPlanTasks, listStatusColors, listTags } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function PacoteDetailPage({ params }: { params: Promise<{ id: string; pacoteId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id, pacoteId } = await params;

  const plan = await getPlan(id);
  if (!plan) notFound();
  if (user.accessibleProjectIds !== "all" && !user.accessibleProjectIds.includes(plan.projectId)) notFound();

  const [project, captacoes, tasks, members, formatTags, channelTags, categoryTags, statusColors] = await Promise.all([
    getProject(plan.projectId),
    listPlanCaptacoes(plan.id),
    listPlanTasks(plan.id),
    listMembers(),
    listTags("formato"),
    listTags("canal"),
    listTags("categoria"),
    listStatusColors(),
  ]);
  if (!project) notFound();

  // O pacote precisa ser DESTE plano: sem essa checagem, trocar o id na URL
  // abriria o pacote de outro cliente por baixo do cabeçalho deste.
  const captacao = captacoes.find((item) => item.id === pacoteId && item.planId === plan.id);
  if (!captacao) notFound();

  return (
    <AdminShell active="planos" user={user}>
      <PacoteDetailView
        plan={plan}
        project={project}
        captacao={captacao}
        captacoes={captacoes}
        initialTasks={tasks.filter((task) => task.captacaoId === captacao.id)}
        members={members}
        formatTags={formatTags}
        channelTags={channelTags}
        categoryTags={categoryTags}
        statusColors={statusColors}
        currentUserId={user.id}
        canEdit={user.role !== "visualizador"}
      />
    </AdminShell>
  );
}
