import { AdminShell } from "@/components/admin-shell";
import { NotificationsView } from "@/components/notifications-view";
import { requirePageAccess } from "@/lib/page-guard";
import { listNotificationsForMember } from "@/lib/storage";

export const dynamic = "force-dynamic";
export default async function NotificationsPage() {
  const user = await requirePageAccess("notificacoes");
  const notifications = await listNotificationsForMember(user.id);
  return <AdminShell active="notificacoes" user={user}><NotificationsView initialNotifications={notifications} /></AdminShell>;
}
