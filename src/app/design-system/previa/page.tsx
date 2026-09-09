import { notFound } from "next/navigation";
import { AdminShell, type AdminShellActive } from "@/components/admin-shell";
import { USER_ROLES, type UserRole } from "@/lib/types";
import { BrandsView } from "@/components/brands-view";
import { ContratosView } from "@/components/contratos-view";
import { ClientDashboard } from "@/components/client-dashboard";
import { DashboardView } from "@/components/dashboard-view";
import { KnowledgeView } from "@/components/knowledge-view";
import { MembrosView } from "@/components/membros-view";
import { PacoteDetailView } from "@/components/pacote-detail-view";
import { PlanoDetailView } from "@/components/plano-detail-view";
import { ProjetosView } from "@/components/projetos-view";
import { PublicSurvey } from "@/components/public-survey";
import { TarefasView } from "@/components/tarefas-view";
import { defaultPreferences } from "@/lib/preferences";
import { parseDescription } from "@/lib/description-sections";
import {
  ACESSO_LISTAS, ACESSO_PROJETOS, AGORA, APROVACOES, CANAIS, CAPTACOES, CATEGORIAS, CONTAGEM_MARCAS,
  CONTRATOS, CORES_STATUS, DOCUMENTOS, FORMATOS, MARCAS, MEMBROS, PESQUISA_DIAGNOSTICO, PLANO, PROJETO,
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

const TELAS = ["dashboard", "tarefas", "plano", "pacote", "cliente", "projetos", "marcas", "membros", "contratos", "conhecimento", "formulario"] as const;
type Tela = (typeof TELAS)[number];

const ATIVO: Record<Tela, AdminShellActive> = {
  dashboard: "dashboard", tarefas: "tarefas", plano: "planos", pacote: "planos", projetos: "projetos",
  cliente: "planos", marcas: "marcas", membros: "membros", contratos: "contratos", conhecimento: "conhecimento",
  formulario: "pesquisas",
};

export default async function PreviaPage({ searchParams }: { searchParams: Promise<{ tela?: string; cargo?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tela: pedida, cargo: cargoPedido } = await searchParams;
  const tela: Tela = TELAS.includes(pedida as Tela) ? (pedida as Tela) : "dashboard";
  // Trocar de cargo aqui mostra o menu que aquela pessoa realmente vê. Conferir
  // hierarquia criando quatro contas de teste é caro demais para uma coisa que
  // se resolve olhando.
  const cargo: UserRole = USER_ROLES.some((papel) => papel.value === cargoPedido) ? (cargoPedido as UserRole) : "dono";
  const usuario = { ...USUARIO, role: cargo };

  // O formulário do cliente não mora dentro do painel — ele é a página pública
  // que a pessoa da empresa abre pelo link. Mostrar dentro do AdminShell daria
  // uma impressão errada de como ele aparece.
  if (tela === "formulario") {
    return <>
      <BarraDeTelas atual={tela} cargo={cargo} />
      <PublicSurvey survey={PESQUISA_DIAGNOSTICO} projectName={PROJETO.name} />
    </>;
  }

  return (
    <AdminShell active={ATIVO[tela]} user={usuario}>
      <BarraDeTelas atual={tela} cargo={cargo} />
      {tela === "dashboard" ? (
        <DashboardView
          tasks={TAREFAS}
          projects={PROJETOS}
          members={MEMBROS}
          tags={[...FORMATOS, ...CANAIS, ...CATEGORIAS]}
          nowIso={AGORA}
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
          events={[
            { id: "previa-captacao", title: "Sugestão de captação: 1ª Captação — Reels", date: "2026-09-11", eventType: "captacao:previa" },
            { id: "previa-entrega", title: "Prazo de criação: Carrosséis — Pacote 1", date: "2026-09-14", eventType: "producao:previa" },
          ]}
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
function BarraDeTelas({ atual, cargo }: { atual: Tela; cargo: UserRole }) {
  return (
    <>
      <div className="previa-bar">
        <strong>Prévia</strong>
        {TELAS.map((tela) => (
          <a key={tela} href={`/design-system/previa?tela=${tela}&cargo=${cargo}`} aria-current={tela === atual ? "page" : undefined}>
            {tela}
          </a>
        ))}
      </div>
      <div className="previa-bar">
        <strong>Cargo</strong>
        {USER_ROLES.map((papel) => (
          <a key={papel.value} href={`/design-system/previa?tela=${atual}&cargo=${papel.value}`} aria-current={papel.value === cargo ? "page" : undefined} title={papel.description}>
            {papel.label}
          </a>
        ))}
      </div>
    </>
  );
}
