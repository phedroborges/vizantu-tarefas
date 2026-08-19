import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ClientDashboard } from "@/components/client-dashboard";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/lib/client-session";
import { getProject, listPlanEvents, listProjectPlanItems, listSatisfactionScores } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seu painel — Vizantu" };

export default async function ClientDashboardPage() {
  const cookieStore = await cookies();
  const projectId = verifyClientSession(cookieStore.get(CLIENT_SESSION_COOKIE)?.value);
  if (!projectId) redirect("/c/invalido");

  let project, items, events, scores;
  try {
    project = await getProject(projectId);
    if (!project) redirect("/c/invalido");
    [items, events, scores] = await Promise.all([
      listProjectPlanItems(projectId),
      listPlanEvents(projectId),
      listSatisfactionScores(projectId),
    ]);
  } catch (err) {
    // redirect() do Next sinaliza por exceção — deixa ela passar, senão o
    // redirect vira "erro de config" por engano.
    if (err && typeof err === "object" && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT")) throw err;
    console.error("[/c/dashboard] falha ao carregar:", err);
    redirect("/c/invalido?motivo=config");
  }

  return (
    <ClientDashboard
      clientName={project.client || project.name}
      roleTitle={project.clientRole ?? null}
      city={project.clientCity ?? null}
      instagramHandle={project.clientInstagram ?? null}
      initialItems={items}
      events={events.map((e: { id: string; title: string; eventDate: string; eventType: string }) => ({ id: e.id, title: e.title, date: e.eventDate, eventType: e.eventType }))}
      initialScore={scores[0]?.score ?? null}
    />
  );
}
