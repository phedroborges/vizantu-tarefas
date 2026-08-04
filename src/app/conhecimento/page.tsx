import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { KnowledgeView } from "@/components/knowledge-view";
import { getCurrentUser } from "@/lib/current-user";
import { listKnowledgeDocs } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ConhecimentoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "visualizador") redirect("/");

  const docs = await listKnowledgeDocs();

  return (
    <AdminShell active="conhecimento" user={user}>
      <KnowledgeView initialDocs={docs} />
    </AdminShell>
  );
}
