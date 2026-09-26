// Tema claro/escuro do app.
//
// A preferência mora em localStorage e é escrita no <html data-vz-theme>, que
// é onde os tokens do design system trocam. "sistema" significa seguir o
// prefers-color-scheme do aparelho. O atributo guarda sempre o resultado
// efetivo (light/dark), enquanto o localStorage preserva a escolha "system".

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = Exclude<Theme, "system">;

export const THEME_KEY = "vz-theme";

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== "system") return theme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // O atributo sempre recebe o tema RESOLVIDO. Deixar o modo "system" sem
  // atributo fazia o .vz-root do <body> redeclarar a paleta clara e vencer os
  // tokens escuros herdados do <html>.
  root.setAttribute("data-vz-theme", resolveTheme(theme));
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Janela anônima: o tema vale só nesta aba, e tudo bem.
  }
}

export function readTheme(): Theme {
  try {
    const salvo = window.localStorage.getItem(THEME_KEY);
    if (salvo === "light" || salvo === "dark" || salvo === "system") return salvo;
  } catch {
    // idem
  }
  return "system";
}

// Roda ANTES da primeira pintura, inline no <head>. Resolve também o modo do
// sistema aqui, antes do React, para não nascer claro e piscar para o escuro.
export const THEME_BOOT_SCRIPT = `(function(){var t="system";try{var s=localStorage.getItem("${THEME_KEY}");if(s==="dark"||s==="light"||s==="system")t=s}catch(e){}var r=t==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":t==="dark"?"dark":"light";document.documentElement.setAttribute("data-vz-theme",r)})();`;
