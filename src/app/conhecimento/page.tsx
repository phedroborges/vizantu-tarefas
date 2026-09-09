import { AdminShell } from "@/components/admin-shell";
import { KnowledgeView } from "@/components/knowledge-view";
import { requirePageAccess } from "@/lib/page-guard";
import { listKnowledgeDocs } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ConhecimentoPage() {
  const user = await requirePageAccess("conhecimento");

  const docs = await listKnowledgeDocs();

  return (
    <AdminShell active="conhecimento" user={user}>
      <KnowledgeView initialDocs={docs} />
    </AdminShell>
  );
}
