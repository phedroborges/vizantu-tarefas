import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { BrandsView } from "@/components/brands-view";
import { getCurrentUser } from "@/lib/current-user";
import { listPlans, listPlanTasks, listProjects } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [plans, projects] = await Promise.all([listPlans(), listProjects()]);
  const visibleProjects = user.accessibleProjectIds === "all" ? projects : projects.filter((project) => user.accessibleProjectIds.includes(project.id));
  const brands = plans.filter((plan) => plan.kind === "brand" && visibleProjects.some((project) => project.id === plan.projectId));
  const taskEntries = await Promise.all(brands.map(async (brand) => {
    const tasks = await listPlanTasks(brand.id);
    return [brand.id, { total: tasks.length, completed: tasks.filter((task) => task.status === "finalizado" || task.status === "aprovado").length }] as const;
  }));
  return <AdminShell active="marcas" user={user}><BrandsView initialBrands={brands} initialProjects={visibleProjects} taskCounts={Object.fromEntries(taskEntries)} canEdit={user.role !== "visualizador"} /></AdminShell>;
}
