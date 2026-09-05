import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { NotificationsView } from "@/components/notifications-view";
import { getCurrentUser } from "@/lib/current-user";
import { listNotificationsForMember } from "@/lib/storage";

export const dynamic = "force-dynamic";
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const notifications = await listNotificationsForMember(user.id);
  return <AdminShell active="notificacoes" user={user}><NotificationsView initialNotifications={notifications} /></AdminShell>;
}
