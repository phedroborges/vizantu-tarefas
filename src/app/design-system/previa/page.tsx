import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { PlanoDetailView } from "@/components/plano-detail-view";
import { TarefasView } from "@/components/tarefas-view";
import { defaultPreferences } from "@/lib/preferences";
import {
  APROVACOES, CANAIS, CAPTACOES, CATEGORIAS, CORES_STATUS, FORMATOS, MEMBROS,
  PLANO, PROJETO, PROJETOS, TAREFAS, TAREFAS_DO_PLANO, USUARIO,
} from "./mock";

// Prévia das telas reais com dados de mentira.
//
// Ela existe pra que dê pra OLHAR o app durante a migração de visual: as telas
// de verdade vivem atrás do login e de um Supabase com dado de cliente, e
// migrar o visual às cegas é como pintar de olhos fechados.
//
// Só existe em desenvolvimento. Em produção a rota simplesmente não existe —
// não é uma tela escondida, é uma tela que não sobe.
export const dynamic = "force-dynamic";

export default async function PreviaPage({ searchParams }: { searchParams: Promise<{ tela?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tela = "tarefas" } = await searchParams;

  if (tela === "plano") {
    return (
      <AdminShell active="planos" user={USUARIO}>
        <PlanoDetailView
          plan={PLANO}
          project={PROJETO}
          initialCaptacoes={CAPTACOES}
          initialTasks={TAREFAS_DO_PLANO}
          initialApprovals={APROVACOES}
          approvalResponses={[]}
          captureSuggestions={[]}
          members={MEMBROS}
          formatTags={FORMATOS}
          channelTags={CANAIS}
          categoryTags={CATEGORIAS}
          statusColors={CORES_STATUS}
          currentUserId={USUARIO.id}
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell active="tarefas" user={USUARIO}>
      <TarefasView
        initialTasks={TAREFAS}
        initialProjects={PROJETOS}
        initialMembers={MEMBROS}
        initialFormatTags={FORMATOS}
        initialChannelTags={CANAIS}
        initialStatusColors={CORES_STATUS}
        initialPreferences={defaultPreferences()}
        canEdit
        canEditStatusColors
        currentUserId={USUARIO.id}
      />
    </AdminShell>
  );
}
