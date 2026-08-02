"use client";

import { BarChart3, CheckSquare, Folders, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function AdminShell({
  active,
  children,
}: {
  active: "dashboard" | "projetos" | "tarefas";
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

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
        </nav>
        <p className="admin-sidebar-note">Acompanhe prazos, responsáveis e entregas em um só lugar.</p>
      </aside>
      <div className="admin-main">
        <header className="admin-mobile-bar">
          <button type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <Image className="admin-mobile-logo" src="/brand/vizantu-dark.svg" width={1518} height={296} alt="Vizantu" priority />
          <span style={{ width: 38 }} />
        </header>
        {children}
      </div>
    </div>
  );
}
