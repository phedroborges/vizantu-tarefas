import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ContratosView } from "@/components/contratos-view";
import { getCurrentUser } from "@/lib/current-user";
import { listContracts, listProjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ContratosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Contrato tem valor, CNPJ e condição comercial — a tela é do dono, igual à
  // rota que serve os dados dela.
  if (user.role !== "dono") redirect("/");

  const [contracts, projects] = await Promise.all([listContracts(), listProjects()]);

  return (
    <AdminShell active="contratos" user={user}>
      <ContratosView initialContracts={contracts} projects={projects} />
    </AdminShell>
  );
}
