"use client";

import { BarChart3, Bell, BookOpen, CheckSquare, ClipboardList, FileQuestion, FileText, Folders, LogOut, Megaphone, Menu, Palette, Trophy, Users, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnnouncementComposer } from "@/components/announcement-composer";
import { AnnouncementGate } from "@/components/announcement-gate";
import { LiveStatus } from "@/components/live-status";
import { NotificationBell } from "@/components/notification-bell";
import { ReadyNudge } from "@/components/ready-nudge";
import { ThemeSwitch } from "@/components/theme-switch";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/vz/logo";
import type { CurrentUser } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/browser-client";
import { podeGerenciarEquipe, podeVer, type AppArea } from "@/lib/permissions";
import { USER_ROLES, type UserRole } from "@/lib/types";

export type AdminShellActive = "financeiro" | "meu_financeiro" | "dashboard" | "ranking" | "projetos" | "tarefas" | "planos" | "pesquisas" | "marcas" | "contratos" | "membros" | "conhecimento" | "notificacoes" | "comunicados";


// A ordem aqui é a ordem do menu. A área de cada item é o que decide quem o
// enxerga — nenhum `if` de cargo espalhado pelo JSX.
const ITENS_DO_MENU: { area: AppArea; href: string; label: string; Icone: typeof BarChart3 }[] = [
  { area: "dashboard", href: "/", label: "Dashboard", Icone: BarChart3 },
  { area: "ranking", href: "/ranking", label: "Ranking", Icone: Trophy },
  { area: "projetos", href: "/projetos", label: "Projetos", Icone: Folders },
  { area: "tarefas", href: "/tarefas", label: "Tarefas", Icone: CheckSquare },
  { area: "notificacoes", href: "/notificacoes", label: "Notificações", Icone: Bell },
  { area: "planos", href: "/planos", label: "Planos", Icone: ClipboardList },
  { area: "pesquisas", href: "/pesquisas", label: "Pesquisas", Icone: FileQuestion },
  { area: "comunicados", href: "/comunicados", label: "Comunicação", Icone: Megaphone },
  { area: "marcas", href: "/marcas", label: "Marcas", Icone: Palette },
  { area: "financeiro", href: "/financeiro", label: "Financeiro", Icone: Wallet },
  { area: "meu_financeiro", href: "/meu-financeiro", label: "Meu financeiro", Icone: Wallet },
  { area: "contratos", href: "/contratos", label: "Contratos", Icone: FileText },
  { area: "membros", href: "/membros", label: "Membros", Icone: Users },
  { area: "conhecimento", href: "/conhecimento", label: "Base de conhecimento", Icone: BookOpen },
];

const CARGO: Record<UserRole, string> = Object.fromEntries(USER_ROLES.map((papel) => [papel.value, papel.label])) as Record<UserRole, string>;

export function AdminShell({
  active,
  user,
  children,
}: {
  active: AdminShellActive;
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="admin-shell">
      <button
        className={`admin-menu-backdrop ${menuOpen ? "visible" : ""}`}
        type="button"
        aria-label="Fechar menu"
        onClick={() => setMenuOpen(false)}
      />
      <aside className={`admin-sidebar ${menuOpen ? "open" : ""}`} aria-label="Navegação">
        <div className="admin-brand">
          <Logo height={21} />
          <button type="button" className="admin-menu-close" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><X size={19} /></button>
        </div>
        <div className="admin-product">
          <span>Central de tarefas</span>
          <small>Projetos e demandas do time</small>
        </div>
        <nav className="admin-nav">
          {ITENS_DO_MENU.filter((item) => podeVer(user.role, item.area)).map((item) => (
            <Link className={active === item.area ? "active" : ""} href={item.href} key={item.area} onClick={() => setMenuOpen(false)}>
              <item.Icone size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <ThemeSwitch />
        <div className="admin-user">
          <Avatar name={user.name} size={28} />
          <div>
            <strong>{user.name}</strong>
            <small>{CARGO[user.role]}</small>
          </div>
          <button type="button" className="admin-user-signout" onClick={signOut} title="Sair" aria-label="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <div className="admin-global-actions"><LiveStatus /><NotificationBell />{podeGerenciarEquipe(user.role) ? <AnnouncementComposer currentUserRole={user.role} /> : null}</div>
        {/* Enviar aviso é ação de qualquer lugar, não de uma tela específica. */}
        <header className="admin-mobile-bar">
          <button type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <Logo className="admin-mobile-logo" height={20} />
          <span style={{ width: 38 }} />
        </header>
        {children}
      </div>
      <AnnouncementGate />
      <ReadyNudge />
    </div>
  );
}
