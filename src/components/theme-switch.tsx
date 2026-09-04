"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";

const OPCOES: { value: Theme; label: string; icone: React.ReactNode }[] = [
  { value: "light", label: "Claro", icone: <Sun size={13} /> },
  { value: "dark", label: "Escuro", icone: <Moon size={13} /> },
  { value: "system", label: "Automático", icone: <Monitor size={13} /> },
];

// O tema salvo é uma fonte de dados EXTERNA ao React (localStorage), e entra
// por useSyncExternalStore: o snapshot de servidor devolve "system", então
// servidor e cliente renderizam a mesma coisa no primeiro passo e não há erro
// de hidratação. O <html> já está com o tema certo desde antes da pintura
// (THEME_BOOT_SCRIPT), então nada pisca — o que se ajusta aqui é só qual botão
// aparece marcado.
function assinar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("vz-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("vz-theme-change", callback);
  };
}

export function ThemeSwitch() {
  const tema = React.useSyncExternalStore(assinar, readTheme, () => "system" as Theme);

  function trocar(proximo: Theme) {
    applyTheme(proximo);
    // localStorage não avisa a própria aba, só as outras — o evento próprio é
    // o que faz este componente reagir ao clique.
    window.dispatchEvent(new Event("vz-theme-change"));
  }

  return (
    <div className="admin-theme" role="group" aria-label="Tema da interface">
      {OPCOES.map((opcao) => (
        <button
          key={opcao.value}
          type="button"
          aria-pressed={tema === opcao.value}
          onClick={() => trocar(opcao.value)}
          title={opcao.label}
        >
          {opcao.icone}
          <span className="admin-theme__label">{opcao.label}</span>
        </button>
      ))}
    </div>
  );
}
