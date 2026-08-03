import { AdminShell } from "@/components/admin-shell";
import { AssistantPage } from "@/components/assistant-page";

export default function AssistentePage() {
  return (
    <AdminShell active="assistente">
      <AssistantPage />
    </AdminShell>
  );
}
