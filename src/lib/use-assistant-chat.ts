"use client";

import { useState } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: string[];
  pendingConfirmation?: { taskId: string; taskName: string } | null;
  confirmed?: boolean;
};

function newId() {
  return Math.random().toString(36).slice(2);
}

// Compartilhado pelo widget flutuante (modo legado: manda o histórico
// inteiro a cada turno, nada é salvo) e pelo chat em tela cheia (modo
// conversationId: manda só a mensagem nova, o servidor é dono do histórico
// persistido) — send() aceita um override de conversationId porque, ao criar
// uma conversa nova na hora do primeiro envio, o id ainda não estaria
// refletido no `options` fechado no render anterior.
export function useAssistantChat(options: { pageContext?: string; conversationId?: string } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  async function send(text: string, images?: string[], conversationIdOverride?: string) {
    const trimmed = text.trim();
    if ((!trimmed && !images?.length) || isSending) return;
    const conversationId = conversationIdOverride ?? options.conversationId;
    const userMessage: ChatMessage = { id: newId(), role: "user", text: trimmed, images };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsSending(true);
    const payload = conversationId
      ? { conversationId, message: trimmed, images, ...(options.pageContext ? { pageContext: options.pageContext } : {}) }
      : {
          messages: nextMessages.map((m) => ({ role: m.role, content: m.text, images: m.images })),
          ...(options.pageContext ? { pageContext: options.pageContext } : {}),
        };
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
      body: JSON.stringify({ confirmDeleteTaskId: taskId, ...(options.conversationId ? { conversationId: options.conversationId } : {}) }),
    });
    const result = await response.json();
    setMessages((current) => [...current, { id: newId(), role: "assistant", text: result.message }]);
  }

  return { messages, setMessages, isSending, send, confirmDelete };
}
