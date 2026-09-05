"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Notification } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button, EmptyState, IconButton } from "@/components/vz";

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    fetch("/api/notifications").then((response) => response.json()).then((data) => { setItems(data.notifications || []); setUnread(data.unread || 0); }).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(load, 60_000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
  }, [load]);

  async function read(item: Notification) {
    if (!item.readAt) { await fetch(`/api/notifications/${item.id}`, { method: "PATCH" }); setUnread((value) => Math.max(0, value - 1)); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)); }
  }
  async function readAll() { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); setUnread(0); setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))); }

  return <Popover>
    <PopoverTrigger render={<IconButton className="notification-bell" aria-label={`${unread} notificações não lidas`} title="Notificações" />}><Bell size={17} />{unread ? <span>{unread > 99 ? "99+" : unread}</span> : null}</PopoverTrigger>
    <PopoverContent align="end" className="notification-popover !p-0">
      <header><div><strong>Notificações</strong><small>{unread ? `${unread} não lida${unread > 1 ? "s" : ""}` : "Tudo em dia"}</small></div>{unread ? <Button size="sm" variant="ghost" onClick={readAll}><CheckCheck size={14} /> Ler todas</Button> : null}</header>
      <div className="notification-preview">{items.slice(0, 6).map((item) => <Link key={item.id} href={item.actionUrl || "/notificacoes"} className={item.readAt ? "" : "is-unread"} onClick={() => read(item)}><i /><span><strong>{item.title}</strong><small>{item.body}</small></span></Link>)}{!items.length ? <EmptyState icon={<Bell size={20} />} title="Nenhuma notificação" description="Menções, tarefas e avisos aparecerão aqui." /> : null}</div>
      <footer><Link href="/notificacoes">Abrir caixa de entrada</Link></footer>
    </PopoverContent>
  </Popover>;
}
