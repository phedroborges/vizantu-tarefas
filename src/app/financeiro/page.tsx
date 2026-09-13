import { AdminShell } from "@/components/admin-shell";
import { FinanceDashboard } from "@/components/finance-dashboard";
import { requirePageAccess } from "@/lib/page-guard";
export const dynamic = "force-dynamic";
export const metadata = { title: "Financeiro — Vizantu" };
export default async function FinancePage() {
  const user = await requirePageAccess("financeiro");
  return <AdminShell active="financeiro" user={user}><FinanceDashboard /></AdminShell>;
}
