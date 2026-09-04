import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// A Mona Sans (a fonte da casa) é servida do próprio domínio, declarada em
// styles/vizantu.css. A mono continua vindo do Google porque só aparece em
// número técnico e token, fora do caminho crítico.
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vizantu Tarefas",
  description: "Gestão de tarefas e projetos da equipe Vizantu.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={geistMono.variable} suppressHydrationWarning>
      <head>
        {/* Antes da primeira pintura: sem isso a tela nasce clara e pisca pro
            escuro quando o React hidrata. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="vz-root" suppressHydrationWarning>
        <TooltipProvider delay={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
