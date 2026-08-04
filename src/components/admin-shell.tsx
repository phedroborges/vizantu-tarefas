"use client";

import { BarChart3, BookOpen, CheckSquare, Folders, LogOut, Menu, Sparkles, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiAssistant } from "@/components/ai-assistant";
import type { CurrentUser } from "@/lib/current-user";
import { PageContextProvider } from "@/lib/page-context";
import { createClient } from "@/lib/supabase/browser-client";

export type AdminShellActive = "dashboard" | "projetos" | "tarefas" | "membros" | "conhecimento" | "assistente";

const PAGE_LABELS: Record<AdminShellActive, string> = {
  dashboard: "Página atual: Dashboard (visão geral de métricas, prazos e ranking do time).",
  projetos: "Página atual: Projetos.",
  tarefas: "Página atual: Tarefas.",
  membros: "Página atual: Membros.",
  conhecimento: "Página atual: Base de conhecimento.",
  assistente: "Página atual: Assistente (chat completo).",
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
          <Image src="/brand/vizantu-white.svg" width={1518} height={296} alt="Vizantu" priority />
          <button type="button" className="admin-menu-close" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><X size={19} /></button>
        </div>
        <div className="admin-product">
          <span>Central de tarefas</span>
          <small>Projetos e demandas do time</small>
        </div>
        <nav className="admin-nav">
          <Link className={active === "dashboard" ? "active" : ""} href="/" onClick={() => setMenuOpen(false)}>
            <BarChart3 size={18} />
            <span>Dashboard</span>
          </Link>
          <Link className={active === "projetos" ? "active" : ""} href="/projetos" onClick={() => setMenuOpen(false)}>
            <Folders size={18} />
            <span>Projetos</span>
          </Link>
          <Link className={active === "tarefas" ? "active" : ""} href="/tarefas" onClick={() => setMenuOpen(false)}>
            <CheckSquare size={18} />
            <span>Tarefas</span>
          </Link>
          {user.role === "dono" ? (
            <Link className={active === "membros" ? "active" : ""} href="/membros" onClick={() => setMenuOpen(false)}>
              <Users size={18} />
              <span>Membros</span>
            </Link>
          ) : null}
          {user.role !== "visualizador" ? (
            <Link className={active === "conhecimento" ? "active" : ""} href="/conhecimento" onClick={() => setMenuOpen(false)}>
              <BookOpen size={18} />
              <span>Base de conhecimento</span>
            </Link>
          ) : null}
          {user.aiEnabled ? (
            <Link className={active === "assistente" ? "active" : ""} href="/assistente" onClick={() => setMenuOpen(false)}>
              <Sparkles size={18} />
              <span>Assistente</span>
            </Link>
          ) : null}
        </nav>
        <div className="admin-user">
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button type="button" className="admin-user-signout" onClick={signOut} title="Sair" aria-label="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-mobile-bar">
          <button type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <Image className="admin-mobile-logo" src="/brand/vizantu-dark.svg" width={1518} height={296} alt="Vizantu" priority />
          <span style={{ width: 38 }} />
        </header>
        {children}
      </div>
      {user.aiEnabled ? <AiAssistant /> : null}
    </div>
    </PageContextProvider>
  );
}
