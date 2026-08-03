"use client";

import { Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type DeadlinesSummary = { overdue: { name: string }[]; upcoming: { name: string }[] };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pendingConfirmation?: { taskId: string; taskName: string };
  confirmed?: boolean;
};

function newId() {
  return Math.random().toString(36).slice(2);
}

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
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
        setMessages([{ id: newId(), role: "assistant", text: "Oi! Como posso ajudar com as tarefas?" }]);
      });
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, isSending]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    const userMessage: ChatMessage = { id: newId(), role: "user", text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: nextMessages.map((m) => ({ role: m.role, content: m.text })) }),
    });
    const result = await response.json();
    setIsSending(false);
    setMessages((current) => [
      ...current,
      {
        id: newId(),
        role: "assistant",
        text: result.error || result.message || "Não entendi, pode reformular?",
        pendingConfirmation: result.pendingConfirmation,
      },
    ]);
  }

  async function confirmDelete(messageId: string, taskId: string) {
    setMessages((current) => current.map((m) => (m.id === messageId ? { ...m, confirmed: true } : m)));
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmDeleteTaskId: taskId }),
    });
    const result = await response.json();
    setMessages((current) => [...current, { id: newId(), role: "assistant", text: result.message }]);
  }

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
          </div>
          <div className="ai-widget-body" ref={bodyRef}>
            {messages.map((message) => (
              <div key={message.id} className={`ai-chat-message ${message.role}`}>
                <p>{message.text}</p>
                {message.pendingConfirmation && !message.confirmed ? (
                  <button type="button" className="ai-confirm-button" onClick={() => confirmDelete(message.id, message.pendingConfirmation!.taskId)}>
                    <Check size={11} /> Confirmar exclusão
                  </button>
                ) : null}
              </div>
            ))}
            {isSending ? (
              <div className="ai-chat-message assistant">
                <Loader2 size={14} className="ai-spin" />
              </div>
            ) : null}
          </div>
          <form className="ai-widget-footer" onSubmit={send}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Pergunte sobre suas tarefas..."
              disabled={isSending}
              maxLength={500}
            />
            <button type="submit" className="icon-button" disabled={isSending || !input.trim()} aria-label="Enviar">
              <Send size={14} />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
