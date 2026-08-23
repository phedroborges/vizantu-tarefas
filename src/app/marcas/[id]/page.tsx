import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { BrandDetailView } from "@/components/brand-detail-view";
import { getCurrentUser } from "@/lib/current-user";
import { getPlan, getProject, listMembers, listPlanTasks, listStatusColors, listTags } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan || plan.kind !== "brand") notFound();
  if (user.accessibleProjectIds !== "all" && !user.accessibleProjectIds.includes(plan.projectId)) notFound();
  const [project, tasks, members, formatTags, channelTags, categoryTags, statusColors] = await Promise.all([getProject(plan.projectId), listPlanTasks(plan.id), listMembers(), listTags("formato"), listTags("canal"), listTags("categoria"), listStatusColors()]);
  if (!project) notFound();
  return <AdminShell active="marcas" user={user}><BrandDetailView plan={plan} project={project} initialTasks={tasks} members={members} formatTags={formatTags} channelTags={channelTags} categoryTags={categoryTags} statusColors={statusColors} currentUserId={user.id} canEdit={user.role !== "visualizador"} /></AdminShell>;
}
