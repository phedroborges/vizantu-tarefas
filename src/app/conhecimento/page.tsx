import { AdminShell } from "@/components/admin-shell";
import { KnowledgeView } from "@/components/knowledge-view";
import { listKnowledgeDocs } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ConhecimentoPage() {
  const docs = await listKnowledgeDocs();

  return (
    <AdminShell active="conhecimento">
      <KnowledgeView initialDocs={docs} />
    </AdminShell>
  );
}
