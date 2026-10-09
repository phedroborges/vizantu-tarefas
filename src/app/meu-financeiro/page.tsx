import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { MemberFinanceView, type MemberPerformance } from "@/components/member-finance-view";
import { getCurrentUser } from "@/lib/current-user";
import { buildDashboardReport } from "@/lib/dashboard-metrics";
import { dayRangeInstants, resolveDashboardPeriod, type DashboardDayRange } from "@/lib/dashboard-period";
import { todayIso } from "@/lib/dates";
import { buildMemberFinance } from "@/lib/finance/member-profile";
import { loadFinanceProduction } from "@/lib/finance/storage";
import { podeVerFinanceiroDe, telaInicial } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu financeiro — Vizantu" };

type PageProps = { searchParams: Promise<{ membro?: string | string[]; periodo?: string | string[]; de?: string | string[]; ate?: string | string[] }> };

export default async function MemberFinancePage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isOwner = user.role === "dono";
  // Antes de carregar qualquer dado: quem não é da equipe que produz, nem o
  // dono, não tem extrato para ver.
  if (!podeVerFinanceiroDe(user.role, user.id, user.id)) redirect(telaInicial(user.role));
  const params = await searchParams;
  const data = await loadFinanceProduction();
  const people = data.members
    .filter((member) => member.active && (member.role === "diretor_criativo" || member.role === "social_media"))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  // Só o dono escolhe de quem é o extrato. Para o resto da equipe o `?membro=`
  // é ignorado: cada um abre o seu, e apenas o seu.
  const requested = Array.isArray(params.membro) ? params.membro[0] : params.membro;
  const memberId = isOwner ? (people.find((person) => person.id === requested) ?? people[0])?.id : user.id;

  const today = todayIso();
  const period = resolveDashboardPeriod(params, today, "mes");
  const profile = memberId ? buildMemberFinance({ data, memberId, range: period.range, previous: period.previous, today }) : null;

  // O tempo de trabalho vem da mesma conta do dashboard, recortada na pessoa.
  const nowIso = new Date().toISOString();
  const measured = (range?: DashboardDayRange) => buildDashboardReport({
    tasks: data.tasks, projects: data.projects, members: data.members, tags: data.tags, nowIso, window: range && dayRangeInstants(range),
  }).metrics.members.find((member) => member.memberId === memberId);
  const current = profile ? measured(period.range) : undefined;
  const before = profile && period.previous ? measured(period.previous) : undefined;
  const creative = current?.area === "criacao";
  const performance: MemberPerformance | undefined = current && {
    area: current.area,
    averageMs: creative ? current.creativeAverageMs : current.strategyAverageMs,
    samples: creative ? current.creativeDeliveries : current.strategyTasks,
    previousAverageMs: creative ? before?.creativeAverageMs : before?.strategyAverageMs,
    openTasks: current.openTasks,
  };

  return (
    <AdminShell active={isOwner ? "financeiro" : "meu_financeiro"} user={user}>
      <MemberFinanceView
        profile={profile}
        period={period}
        performance={performance}
        compare={Boolean(period.previous)}
        people={isOwner ? people.map((person) => ({ id: person.id, name: person.name })) : undefined}
      />
    </AdminShell>
  );
}
