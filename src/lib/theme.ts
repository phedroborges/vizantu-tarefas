// Tema claro/escuro do app.
//
// A preferência mora em localStorage e é escrita no <html data-vz-theme>, que
// é onde os tokens do design system trocam. "sistema" significa seguir o
// prefers-color-scheme do aparelho — e nesse caso NENHUM atributo é escrito,
// porque o CSS já resolve isso sozinho pela media query.

export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "vz-theme";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-vz-theme");
  else root.setAttribute("data-vz-theme", theme);
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

// Roda ANTES da primeira pintura, inline no <head>. Sem isso a tela nasce clara
// e pisca pro escuro depois que o React hidrata — que é o defeito clássico de
// tema em app com renderização no servidor.
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-vz-theme",t)}}catch(e){}})();`;
