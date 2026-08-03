"use client";

import { Check, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/chat-composer";
import { ChatThread } from "@/components/chat-thread";
import { useAssistantChat } from "@/lib/use-assistant-chat";

type ConversationSummary = { id: string; title: string; updatedAt: string };

const STARTERS = [
  "Como estão as tarefas do projeto Tawper essa semana?",
  "Vamos documentar o processo de criação de estático",
  "Quais tarefas estão sem responsável?",
  "Me ajuda a montar a estratégia de conteúdo do próximo mês",
];

export function AssistantPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const { messages, setMessages, isSending, send, confirmDelete } = useAssistantChat({ conversationId: activeId ?? undefined });
  const bodyRef = useRef<HTMLDivElement>(null);
  const hasLoadedListRef = useRef(false);

  useEffect(() => {
    if (hasLoadedListRef.current) return;
    hasLoadedListRef.current = true;
    fetch("/api/assistant/conversations")
      .then((response) => response.json())
      .then((data: { conversations: ConversationSummary[] }) => setConversations(data.conversations));
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, isSending]);

  function refreshList() {
    fetch("/api/assistant/conversations")
      .then((response) => response.json())
      .then((data: { conversations: ConversationSummary[] }) => setConversations(data.conversations));
  }

  async function openConversation(id: string) {
    if (id === activeId) return;
    setActiveId(id);
    setMessages([]);
    const response = await fetch(`/api/assistant/conversations/${id}`);
    if (!response.ok) return;
    const data = await response.json();
    setMessages(
      data.conversation.messages.map((m: { id: string; role: "user" | "assistant"; text: string; pendingConfirmation?: unknown }) => ({
        ...m,
        confirmed: Boolean(m.pendingConfirmation),
      })),
    );
  }

  function startNewConversation() {
    setActiveId(null);
    setMessages([]);
  }

  async function submit(text: string, images: string[] = []) {
    let id = activeId;
    if (!id) {
      const response = await fetch("/api/assistant/conversations", { method: "POST" });
      const data = await response.json();
      id = data.conversation.id;
      setActiveId(id);
      setConversations((current) => [{ id: data.conversation.id, title: data.conversation.title, updatedAt: data.conversation.updatedAt }, ...current]);
    }
    await send(text, images, id!);
    refreshList();
  }

  function startRename(conversation: ConversationSummary) {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
  }

  async function commitRename() {
    const id = renamingId;
    if (!id) return;
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    setConversations((current) => current.map((c) => (c.id === id ? { ...c, title } : c)));
    await fetch(`/api/assistant/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  }

  async function removeConversation(conversation: ConversationSummary) {
    if (!window.confirm(`Excluir a conversa "${conversation.title}"?`)) return;
    const response = await fetch(`/api/assistant/conversations/${conversation.id}`, { method: "DELETE" });
    if (!response.ok) return;
    setConversations((current) => current.filter((c) => c.id !== conversation.id));
    if (activeId === conversation.id) startNewConversation();
  }

  return (
    <div className="assistant-shell">
      <aside className="assistant-sidebar">
        <button type="button" className="assistant-new-chat" onClick={startNewConversation}>
          <Plus size={14} /> Nova conversa
        </button>
        <ul className="assistant-conv-list">
          {conversations.map((conversation) => (
            <li
              key={conversation.id}
              className={`assistant-conv-item ${conversation.id === activeId ? "active" : ""} ${renamingId === conversation.id ? "renaming" : ""}`}
            >
              {renamingId === conversation.id ? (
                <input
                  autoFocus
                  className="assistant-conv-rename-input"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRename();
                    }
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setRenamingId(null);
                    }
                  }}
                  onBlur={commitRename}
                  maxLength={80}
                />
              ) : (
                <button type="button" className="assistant-conv-title" onClick={() => openConversation(conversation.id)}>
                  {conversation.title}
                </button>
              )}
              {renamingId === conversation.id ? (
                <button type="button" className="assistant-conv-action" onClick={commitRename} aria-label="Salvar nome">
                  <Check size={12} />
                </button>
              ) : (
                <>
                  <button type="button" className="assistant-conv-action" onClick={() => startRename(conversation)} aria-label="Renomear conversa">
                    <Pencil size={12} />
                  </button>
                  <button type="button" className="assistant-conv-action" onClick={() => removeConversation(conversation)} aria-label="Excluir conversa">
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <div className="assistant-main">
        <div className="assistant-body" ref={bodyRef}>
          {messages.length ? (
            <ChatThread
              messages={messages}
              isSending={isSending}
              onConfirmDelete={confirmDelete}
              messageClassName="assistant-message"
              confirmButtonClassName="ai-confirm-button"
            />
          ) : (
            <div className="assistant-empty">
              <Sparkles size={28} />
              <h3>Por onde vamos começar?</h3>
              <p>Peça um resumo, edite tarefas de qualquer projeto, ou documente um processo junto comigo.</p>
              <div className="assistant-starters">
                {STARTERS.map((starter) => (
                  <button key={starter} type="button" onClick={() => submit(starter)}>{starter}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <ChatComposer
          variant="full"
          disabled={isSending}
          placeholder="Pergunte, peça uma edição, ou vamos documentar um processo juntos..."
          onSubmit={submit}
        />
      </div>
    </div>
  );
}
