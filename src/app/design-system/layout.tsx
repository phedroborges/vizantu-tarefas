import type { Metadata } from "next";
import "./vitrine.css";

// Só a moldura da vitrine entra aqui. O design system em si (styles/vizantu.css)
// já é carregado pelo globals.css do layout raiz — ele agora é a base do app
// inteiro, e não mais uma folha exclusiva desta rota.

export const metadata: Metadata = {
  title: "Design System — Vizantu",
  description: "Fundamentos e componentes que sustentam todas as telas da Vizantu.",
  robots: { index: false, follow: false },
};

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
