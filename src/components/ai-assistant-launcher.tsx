"use client";

import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";
import { useState } from "react";

const AiAssistant = dynamic(() => import("./ai-assistant").then((module) => module.AiAssistant), {
  loading: () => <button type="button" className="ai-widget-button" disabled aria-label="Carregando assistente"><Sparkles size={18} /></button>,
});

// O chat só entra no navegador quando aberto. Depois permanece montado para
// preservar a conversa ao fechar e reabrir o widget.
export function AiAssistantLauncher() {
  const [started, setStarted] = useState(false);
  return started ? <AiAssistant initiallyOpen /> : (
    <button type="button" className="ai-widget-button" onClick={() => setStarted(true)} aria-label="Abrir assistente de IA"><Sparkles size={18} /></button>
  );
}
