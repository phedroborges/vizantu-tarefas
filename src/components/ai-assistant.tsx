"use client";

import { Maximize2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat-composer";
import { ChatThread } from "@/components/chat-thread";
import { usePageContextText } from "@/lib/page-context";
import { useAssistantChat } from "@/lib/use-assistant-chat";

type DeadlinesSummary = { overdue: { name: string }[]; upcoming: { name: string }[] };

function newId() {
  return Math.random().toString(36).slice(2);
}

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const pageContext = usePageContextText();
  const { messages, setMessages, isSending, send, confirmDelete } = useAssistantChat({ pageContext });
  const hasLoadedSummaryRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || hasLoadedSummaryRef.current) return;
    hasLoadedSummaryRef.current = true;
    fetch("/api/assistant")
      .then((response) => response.json())
      .then((data: DeadlinesSummary) => {
        const parts: string[] = [];
        if (data.overdue?.length) parts.push(`${data.overdue.length} atrasada${data.overdue.length === 1 ? "" : "s"}: ${data.overdue.map((t) => t.name).join(", ")}`);
        if (data.upcoming?.length) parts.push(`${data.upcoming.length} com prazo nos próximos 7 dias: ${data.upcoming.map((t) => t.name).join(", ")}`);
        const text = parts.length ? `Oi! Antes de mais nada: ${parts.join(". ")}.` : "Oi! Nenhuma tarefa atrasada ou vencendo essa semana. Tudo em dia.";
        setMessages([{ id: newId(), role: "assistant", text }]);
      })
      .catch(() => {
        setMessages([{ id: newId(), role: "assistant", text: "Oi! Como posso ajudar com o que você está vendo agora?" }]);
      });
  }, [open, setMessages]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, isSending]);

  return (
    <>
      <button type="button" className="ai-widget-button" onClick={() => setOpen((current) => !current)} aria-label="Abrir assistente de IA">
        {open ? <X size={18} /> : <Sparkles size={18} />}
      </button>
      {open ? (
        <div className="ai-widget-panel">
          <div className="ai-widget-header">
            <Sparkles size={14} />
            <span>Assistente Vizantu</span>
            <Link href="/assistente" className="ai-widget-expand" title="Abrir chat completo" aria-label="Abrir chat completo">
              <Maximize2 size={13} />
            </Link>
          </div>
          <div className="ai-widget-body" ref={bodyRef}>
            <ChatThread messages={messages} isSending={isSending} onConfirmDelete={confirmDelete} />
          </div>
          <ChatComposer variant="compact" disabled={isSending} placeholder="Pergunte sobre o que você está vendo..." onSubmit={(text, images) => send(text, images)} />
        </div>
      ) : null}
    </>
  );
}
