"use client";

import { BarChart3, Bell, BookOpen, CheckSquare, ClipboardList, FileQuestion, FileText, Folders, LogOut, Menu, Palette, Sparkles, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiAssistant } from "@/components/ai-assistant";
import { AnnouncementComposer } from "@/components/announcement-composer";
import { AnnouncementGate } from "@/components/announcement-gate";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeSwitch } from "@/components/theme-switch";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/vz/logo";
import type { CurrentUser } from "@/lib/current-user";
import { PageContextProvider } from "@/lib/page-context";
import { createClient } from "@/lib/supabase/browser-client";
import { podeGerenciarEquipe, podeVer, type AppArea } from "@/lib/permissions";
import { USER_ROLES, type UserRole } from "@/lib/types";

export type AdminShellActive = "dashboard" | "projetos" | "tarefas" | "planos" | "pesquisas" | "marcas" | "contratos" | "membros" | "conhecimento" | "assistente" | "notificacoes";


// A ordem aqui é a ordem do menu. A área de cada item é o que decide quem o
// enxerga — nenhum `if` de cargo espalhado pelo JSX.
const ITENS_DO_MENU: { area: AppArea; href: string; label: string; Icone: typeof BarChart3 }[] = [
  { area: "dashboard", href: "/", label: "Dashboard", Icone: BarChart3 },
  { area: "projetos", href: "/projetos", label: "Projetos", Icone: Folders },
  { area: "tarefas", href: "/tarefas", label: "Tarefas", Icone: CheckSquare },
  { area: "notificacoes", href: "/notificacoes", label: "Notificações", Icone: Bell },
  { area: "planos", href: "/planos", label: "Planos", Icone: ClipboardList },
  { area: "pesquisas", href: "/pesquisas", label: "Pesquisas", Icone: FileQuestion },
  { area: "marcas", href: "/marcas", label: "Marcas", Icone: Palette },
  { area: "contratos", href: "/contratos", label: "Contratos", Icone: FileText },
  { area: "membros", href: "/membros", label: "Membros", Icone: Users },
  { area: "conhecimento", href: "/conhecimento", label: "Base de conhecimento", Icone: BookOpen },
  { area: "assistente", href: "/assistente", label: "Assistente", Icone: Sparkles },
];

const CARGO: Record<UserRole, string> = Object.fromEntries(USER_ROLES.map((papel) => [papel.value, papel.label])) as Record<UserRole, string>;

const PAGE_LABELS: Record<AdminShellActive, string> = {
  dashboard: "Página atual: Dashboard (visão geral de métricas, prazos e ranking do time).",
  projetos: "Página atual: Projetos.",
  tarefas: "Página atual: Tarefas.",
  planos: "Página atual: Planos (conteúdos e processos organizados por cliente).",
  pesquisas: "Página atual: Pesquisas e formulários dos clientes.",
  marcas: "Página atual: Marcas (fluxos de branding e seus entregáveis).",
  contratos: "Página atual: Contratos (modelos da casa preenchidos com os dados do cliente).",
  membros: "Página atual: Membros.",
  conhecimento: "Página atual: Base de conhecimento.",
  assistente: "Página atual: Assistente (chat completo).",
  notificacoes: "Página atual: Caixa de entrada de notificações.",
};

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
    <PageContextProvider page={PAGE_LABELS[active]}>
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
            item.area === "assistente" && !user.aiEnabled ? null : (
              <Link className={active === item.area ? "active" : ""} href={item.href} key={item.area} onClick={() => setMenuOpen(false)}>
                <item.Icone size={18} />
                <span>{item.label}</span>
              </Link>
            )
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
        <div className="admin-global-actions"><NotificationBell />{podeGerenciarEquipe(user.role) ? <AnnouncementComposer currentUserRole={user.role} /> : null}</div>
        {/* Enviar aviso é ação de qualquer lugar, não de uma tela específica. */}
        <header className="admin-mobile-bar">
          <button type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <Logo className="admin-mobile-logo" height={20} />
          <span style={{ width: 38 }} />
        </header>
        {children}
      </div>
      {/* Na página do chat completo o widget seria redundante — e o botão
          flutuante cobre o "Enviar" do composer. */}
      {user.aiEnabled && active !== "assistente" ? <AiAssistant /> : null}
      <AnnouncementGate />
    </div>
    </PageContextProvider>
  );
}
