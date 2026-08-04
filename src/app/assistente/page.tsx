import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { AssistantPage } from "@/components/assistant-page";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function AssistentePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.aiEnabled) redirect("/");

  return (
    <AdminShell active="assistente" user={user}>
      <AssistantPage />
    </AdminShell>
  );
}
