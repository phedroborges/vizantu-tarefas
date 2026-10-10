import { AdminShell } from "@/components/admin-shell";
import { PeriodBar } from "@/components/period-bar";
import { TeamRanking } from "@/components/team-ranking";
import { buildDashboardReport } from "@/lib/dashboard-metrics";
import { dayRangeInstants, resolveDashboardPeriod } from "@/lib/dashboard-period";
import { todayIso } from "@/lib/dates";
import { requirePageAccess } from "@/lib/page-guard";
import { listMembers, listTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";

type RankingPageProps = { searchParams: Promise<{ periodo?: string | string[]; de?: string | string[]; ate?: string | string[] }> };

export default async function RankingPage({ searchParams }: RankingPageProps) {
  const user = await requirePageAccess("ranking");
  // A disputa é do mês, então é nele que a tela abre.
  const period = resolveDashboardPeriod(await searchParams, todayIso(), "mes");
  // O ranking é o mesmo para todo mundo: conta as tarefas de todos os clientes,
  // e não só as dos que a pessoa atende. Para o navegador vai só o pódio.
  const [tasks, members] = await Promise.all([listTasks({ all: true, projection: "production" }), listMembers()]);
  const { metrics } = buildDashboardReport({
    tasks, projects: [], members, tags: [], nowIso: new Date().toISOString(),
    window: period.range && dayRangeInstants(period.range),
  });

  return (
    <AdminShell active="ranking" user={user}>
      <main className="admin-page dashboard">
        <div className="dashboard-head"><div><span className="eyebrow">Time</span><h1>Ranking</h1><p>Quem mais entrega rápido e com menos refação, na criação e na estratégia.</p></div></div>
        <PeriodBar key={`${period.preset}:${period.range?.from}:${period.range?.to}`} period={period} compares={false} />
        <TeamRanking ranking={metrics.ranking} periodLabel={period.label.toLowerCase()} />
      </main>
    </AdminShell>
  );
}
