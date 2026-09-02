"use client";

import { Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { networkError, responseError } from "@/lib/request-error";
import type { Contract } from "@/lib/types";

type Mensagem = { id: string; role: "user" | "assistant"; text: string };

// Quem renderiza passa key={contract.id}: trocar de contrato REMONTA o painel
// e a conversa começa limpa. O histórico falava de um documento que não está
// mais na tela, e responder sobre o contrato errado é pior que recomeçar.

// Atalhos do que mais se pede num contrato. Não são botões mágicos: eles só
// escrevem a frase no campo, e a IA faz o resto. Existem porque a primeira
// pergunta é sempre a mais difícil de formular.
const ATALHOS = [
  "Deixa esse contrato escalonado: 3 meses a 2 mil, 3 meses a 2500 e 6 meses a 3 mil",
  "Confere se tem alguma cláusula que me deixa exposto",
  "Aumenta o aviso prévio de rescisão para 60 dias",
  "Resume em 5 linhas o que esse contrato obriga a Vizantu a entregar",
];

export function ContractAssistant({
  contract,
  onContractUpdated,
}: {
  contract: Contract;
  onContractUpdated: (contract: Contract) => void;
}) {
  const [messages, setMessages] = useState<Mensagem[]>([]);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  async function enviar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || isSending) return;
    const minha: Mensagem = { id: crypto.randomUUID(), role: "user", text: limpa };
    const historico = [...messages, minha];
    setMessages(historico);
    setText("");
    setIsSending(true);
    setError("");

    try {
      const response = await fetch(`/api/contracts/${contract.id}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historico.map((m) => ({ role: m.role, content: m.text })) }),
      });
      if (!response.ok) {
        setError(await responseError(response, "falar com a IA do contrato"));
        return;
      }
      const result = await response.json();
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: result.message || "" }]);
      // A IA edita o contrato de verdade. Quando ela mexe, a tela ao lado
      // precisa mostrar o documento novo na mesma hora, senão você fica
      // conferindo uma versão que já não existe.
      if (result.contract) onContractUpdated(result.contract);
    } catch {
      setError(networkError("falar com a IA do contrato"));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="contrato-ia no-print">
      <header>
        <Sparkles size={13} />
        <div>
          <strong>IA do contrato</strong>
          <small>Ela está lendo este contrato inteiro e edita direto nele.</small>
        </div>
      </header>

      <div className="contrato-ia-thread">
        {messages.length === 0 && !isSending ? (
          <div className="contrato-ia-atalhos">
            {ATALHOS.map((atalho) => (
              <button key={atalho} type="button" onClick={() => enviar(atalho)}>{atalho}</button>
            ))}
          </div>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className={`contrato-ia-msg ${message.role}`}>
            <p>{message.text}</p>
          </div>
        ))}
        {isSending ? (
          <div className="contrato-ia-msg assistant"><Loader2 size={14} className="ai-spin" /></div>
        ) : null}
        <div ref={fimRef} />
      </div>

      {error ? <p className="contrato-ia-erro">{error}</p> : null}

      <form
        className="contrato-ia-form"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(text);
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Peça uma mudança no contrato ou uma leitura dele"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(text);
            }
          }}
        />
        <button type="submit" className="icon-button" disabled={isSending || !text.trim()} aria-label="Enviar">
          <Send size={15} />
        </button>
      </form>
    </section>
  );
}
