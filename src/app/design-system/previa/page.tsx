import { notFound } from "next/navigation";
import { AdminShell, type AdminShellActive } from "@/components/admin-shell";
import { BrandsView } from "@/components/brands-view";
import { ContratosView } from "@/components/contratos-view";
import { ClientDashboard } from "@/components/client-dashboard";
import { DashboardView } from "@/components/dashboard-view";
import { KnowledgeView } from "@/components/knowledge-view";
import { MembrosView } from "@/components/membros-view";
import { PacoteDetailView } from "@/components/pacote-detail-view";
import { PlanoDetailView } from "@/components/plano-detail-view";
import { ProjetosView } from "@/components/projetos-view";
import { TarefasView } from "@/components/tarefas-view";
import { defaultPreferences } from "@/lib/preferences";
import { parseDescription } from "@/lib/description-sections";
import {
  ACESSO_LISTAS, ACESSO_PROJETOS, APROVACOES, CANAIS, CAPTACOES, CATEGORIAS, CONTAGEM_MARCAS,
  CONTRATOS, CORES_STATUS, DASHBOARD, DOCUMENTOS, FORMATOS, MARCAS, MEMBROS, PLANO, PROJETO,
  PROJETOS, TAREFAS, TAREFAS_DO_PLANO, USUARIO,
} from "./mock";

// Prévia das telas reais com dados de mentira.
//
// Ela existe pra que dê pra OLHAR o app durante a migração de visual: as telas
// de verdade vivem atrás do login e de um Supabase com dado de cliente, e
// migrar o visual às cegas é como pintar de olhos fechados. Como todas as
// views são dirigidas por props, basta montar as props aqui.
//
// Só existe em desenvolvimento. Em produção a rota devolve 404 — não é uma
// tela escondida, é uma tela que não atende.
export const dynamic = "force-dynamic";

const TELAS = ["dashboard", "tarefas", "plano", "pacote", "cliente", "projetos", "marcas", "membros", "contratos", "conhecimento"] as const;
type Tela = (typeof TELAS)[number];

const ATIVO: Record<Tela, AdminShellActive> = {
  dashboard: "dashboard", tarefas: "tarefas", plano: "planos", pacote: "planos", projetos: "projetos",
  cliente: "planos", marcas: "marcas", membros: "membros", contratos: "contratos", conhecimento: "conhecimento",
};

export default async function PreviaPage({ searchParams }: { searchParams: Promise<{ tela?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tela: pedida } = await searchParams;
  const tela: Tela = TELAS.includes(pedida as Tela) ? (pedida as Tela) : "dashboard";

  return (
    <AdminShell active={ATIVO[tela]} user={USUARIO}>
      <BarraDeTelas atual={tela} />
      {tela === "dashboard" ? (
        <DashboardView
          tasks={TAREFAS}
          projectById={new Map(PROJETOS.map((p) => [p.id, p]))}
          projectsCount={PROJETOS.length}
          total={DASHBOARD.total}
          done={DASHBOARD.done}
          inProgress={DASHBOARD.inProgress}
          overdue={DASHBOARD.overdue}
          projectOverview={DASHBOARD.projectOverview}
          ranking={DASHBOARD.ranking}
          maxCount={DASHBOARD.ranking[0]?.count || 1}
        />
      ) : null}

      {tela === "tarefas" ? (
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
      ) : null}

      {tela === "plano" ? (
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
      ) : null}

      {tela === "pacote" ? (
        <PacoteDetailView
          plan={PLANO}
          project={PROJETO}
          captacao={CAPTACOES[0]}
          captacoes={CAPTACOES}
          initialTasks={TAREFAS_DO_PLANO.filter((t) => t.captacaoId === CAPTACOES[0].id)}
          members={MEMBROS}
          formatTags={FORMATOS}
          channelTags={CANAIS}
          categoryTags={CATEGORIAS}
          statusColors={CORES_STATUS}
          currentUserId={USUARIO.id}
        />
      ) : null}

      {tela === "cliente" ? (
        <ClientDashboard
          clientName="TerraNet"
          roleTitle="Marketing"
          city="Portelândia"
          instagramHandle="terranet"
          initialItems={TAREFAS_DO_PLANO.map((task, index) => ({
            id: task.id, name: task.name, status: task.status, dueDate: task.dueDate || null,
            captacaoLabel: CAPTACOES.find((capture) => capture.id === task.captacaoId)?.label || null,
            formatLabel: FORMATOS.find((tag) => task.formatTagIds.includes(tag.id))?.label || null,
            channelLabel: CANAIS.find((tag) => task.channelTagIds.includes(tag.id))?.label || "Instagram",
            categoryLabel: CATEGORIAS.find((tag) => task.categoryTagIds.includes(tag.id))?.label || null,
            reference: parseDescription(task.description).referencia || (index === 0 ? "https://instagram.com/reel/referencia" : null),
            description: task.description || null, materialLink: task.driveLink || null,
            approvalStatus: (index < 2 ? "approved" : "pending") as "approved" | "pending", reviewVersion: index === 1 ? 100 : 1, updatedAt: task.updatedAt,
          }))}
          events={[]}
          initialScore={9}
        />
      ) : null}

      {tela === "projetos" ? <ProjetosView initialProjects={PROJETOS} initialTasks={TAREFAS} canEdit /> : null}
      {tela === "marcas" ? <BrandsView initialBrands={MARCAS} initialProjects={PROJETOS} taskCounts={CONTAGEM_MARCAS} canEdit /> : null}
      {tela === "membros" ? (
        <MembrosView
          initialMembers={MEMBROS}
          projects={PROJETOS}
          initialProjectAccess={ACESSO_PROJETOS}
          initialListAccess={ACESSO_LISTAS}
        />
      ) : null}
      {tela === "contratos" ? <ContratosView initialContracts={CONTRATOS} projects={PROJETOS} /> : null}
      {tela === "conhecimento" ? <KnowledgeView initialDocs={DOCUMENTOS} /> : null}
    </AdminShell>
  );
}

// Só aparece na prévia: um atalho pra pular entre as telas sem editar a URL.
function BarraDeTelas({ atual }: { atual: Tela }) {
  return (
    <div className="previa-bar">
      <strong>Prévia</strong>
      {TELAS.map((tela) => (
        <a key={tela} href={`/design-system/previa?tela=${tela}`} aria-current={tela === atual ? "page" : undefined}>
          {tela}
        </a>
      ))}
    </div>
  );
}
