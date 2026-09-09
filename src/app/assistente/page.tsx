import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AssistantPage } from "@/components/assistant-page";
import { requirePageAccess } from "@/lib/page-guard";

export const dynamic = "force-dynamic";

export default async function AssistentePage() {
  const user = await requirePageAccess("assistente");
  if (!user.aiEnabled) redirect("/");

  return (
    <AdminShell active="assistente" user={user}>
      <AssistantPage />
    </AdminShell>
  );
}
