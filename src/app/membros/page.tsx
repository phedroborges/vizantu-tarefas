import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { MembrosView } from "@/components/membros-view";
import { getCurrentUser } from "@/lib/current-user";
import { listAllProjectAccess, listMembers, listProjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function MembrosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "dono") redirect("/");

  const [members, projects, projectAccess] = await Promise.all([listMembers(), listProjects(), listAllProjectAccess()]);

  return (
    <AdminShell active="membros" user={user}>
      <MembrosView initialMembers={members} projects={projects} initialProjectAccess={projectAccess} />
    </AdminShell>
  );
}
