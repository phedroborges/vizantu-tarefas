"use client";

import { Bell, CheckCheck, Clock3, Megaphone, MessageSquareText, UserCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Button, EmptyState, PageHeader, Segmented } from "@/components/vz";
import type { Notification, NotificationType } from "@/lib/types";

const meta: Record<NotificationType, { label: string; icon: ReactNode }> = {
  mention: { label: "Menção", icon: <MessageSquareText size={17} /> }, task_assigned: { label: "Responsabilidade", icon: <UserCheck size={17} /> }, task_overdue: { label: "Atraso", icon: <Clock3 size={17} /> }, announcement: { label: "Aviso", icon: <Megaphone size={17} /> },
};
type Filter = "all" | NotificationType;

export function NotificationsView({ initialNotifications }: { initialNotifications: Notification[] }) {
  const [items, setItems] = useState(initialNotifications); const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => filter === "all" ? items : items.filter((item) => item.type === filter), [filter, items]);
  const unread = items.filter((item) => !item.readAt).length;
  async function read(item: Notification) { if (item.readAt) return; await fetch(`/api/notifications/${item.id}`, { method: "PATCH" }); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)); }
  async function readAll() { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))); }
  return <main className="admin-page dashboard notifications-page"><PageHeader eyebrow="Sua caixa de entrada" title="Notificações" description="Menções, responsabilidades, atrasos e avisos reunidos em um só lugar." actions={unread ? <Button variant="secondary" onClick={readAll}><CheckCheck size={15} /> Marcar todas como lidas</Button> : null} /><Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "Todas" }, { value: "mention", label: "Menções" }, { value: "task_assigned", label: "Atribuídas" }, { value: "task_overdue", label: "Atrasadas" }, { value: "announcement", label: "Avisos" }]} />
    <section className="notification-inbox">{visible.map((item) => <Link key={item.id} href={item.actionUrl || "#"} className={item.readAt ? "" : "is-unread"} onClick={() => read(item)}><span className={`notification-inbox__icon is-${item.type}`}>{meta[item.type].icon}</span><span className="notification-inbox__copy"><small>{meta[item.type].label}</small><strong>{item.title}</strong><p>{item.body}</p></span><time>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</time></Link>)}{!visible.length ? <EmptyState icon={<Bell size={24} />} title="Nada por aqui" description="Não há notificações neste filtro." /> : null}</section>
  </main>;
}
