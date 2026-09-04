import type { Metadata } from "next";
import "./vizantu.css";

// A folha do sistema é importada AQUI, e não no layout raiz, porque o app
// ainda roda no CSS antigo. Enquanto a migração não acontece, só esta rota
// carrega os tokens novos — o resto do produto continua intacto.

export const metadata: Metadata = {
  title: "Design System — Vizantu",
  description: "Fundamentos e componentes que sustentam todas as telas da Vizantu.",
  robots: { index: false, follow: false },
};

export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
