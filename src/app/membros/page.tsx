import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { MembrosView } from "@/components/membros-view";
import { getCurrentUser } from "@/lib/current-user";
import { listAllMemberListAccess, listAllProjectAccess, listMembers, listProjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function MembrosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "dono") redirect("/");

  const [members, projects, projectAccess, listAccess] = await Promise.all([
    listMembers(),
    listProjects(),
    listAllProjectAccess(),
    listAllMemberListAccess(),
  ]);

  return (
    <AdminShell active="membros" user={user}>
      <MembrosView initialMembers={members} projects={projects} initialProjectAccess={projectAccess} initialListAccess={listAccess} />
    </AdminShell>
  );
}
