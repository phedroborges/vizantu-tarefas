import { Check, Loader2 } from "lucide-react";
import type { ChatMessage } from "@/lib/use-assistant-chat";

export function ChatThread({
  messages,
  isSending,
  onConfirmDelete,
  messageClassName = "ai-chat-message",
  confirmButtonClassName = "ai-confirm-button",
}: {
  messages: ChatMessage[];
  isSending: boolean;
  onConfirmDelete: (messageId: string, taskId: string) => void;
  messageClassName?: string;
  confirmButtonClassName?: string;
}) {
  return (
    <>
      {messages.map((message) => (
        <div key={message.id} className={`${messageClassName} ${message.role}`}>
          {message.images?.length ? (
            <div className="chat-message-images">
              {message.images.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element -- imagem enviada pelo usuário, servida do próprio app
                <img key={url} src={url} alt="Anexo enviado" />
              ))}
            </div>
          ) : null}
          {message.text ? <p>{message.text}</p> : null}
          {message.pendingConfirmation && !message.confirmed ? (
            <button type="button" className={confirmButtonClassName} onClick={() => onConfirmDelete(message.id, message.pendingConfirmation!.taskId)}>
              <Check size={11} /> Confirmar exclusão
            </button>
          ) : null}
        </div>
      ))}
      {isSending ? (
        <div className={`${messageClassName} assistant`}>
          <Loader2 size={14} className="ai-spin" />
        </div>
      ) : null}
    </>
  );
}
