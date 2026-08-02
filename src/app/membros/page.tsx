import { AdminShell } from "@/components/admin-shell";
import { MembrosView } from "@/components/membros-view";
import { listMembers } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function MembrosPage() {
  const members = await listMembers();

  return (
    <AdminShell active="membros">
      <MembrosView initialMembers={members} />
    </AdminShell>
  );
}
