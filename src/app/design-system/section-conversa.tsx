"use client";

import { Link2, Paperclip, Send, Smile } from "lucide-react";
import { Avatar, AvatarStack, Button, Card, Count, IconButton } from "@/components/vz";
import { TIME, pessoa } from "./data";

/* ---------- 12 · Conversa ---------- */

const CONVERSAS = [
  { nome: "Cynthia Almeida", ultima: "Subi a primeira versão do carrossel…", hora: "10:23", nao: 2, presenca: "on" as const },
  { nome: "Erika Iorrana", ultima: "Ajustei e mudei a etapa para Revisão.", hora: "11:02", nao: 0, presenca: "on" as const },
  { nome: "Luis Fontes", ultima: "A captação de sexta foi remarcada.", hora: "ontem", nao: 1, presenca: "away" as const },
  { nome: "Marina Reis", ultima: "Obrigada! Fechado por aqui.", hora: "seg", nao: 0, presenca: "off" as const },
];

export function SecaoConversa() {
  return (
    <section className="ds-section" id="conversa">
      <header className="ds-section__head">
        <span className="vz-eyebrow">12 · Componentes</span>
        <h2 className="vz-h1">Conversa</h2>
        <p className="vz-body">
          Um único desenho para comentário de conteúdo, chat interno do time e resposta do cliente no portal. Balão
          cinza para os outros, roxo suave para você, e o compositor cresce com o texto.
        </p>
      </header>

      <div className="ds-grid ds-grid--2">
        <Card>
          <div className="vz-card__head">
            <div className="vz-card__title">
              <h3 className="vz-h3">Internet segura para crianças</h3>
              <span className="vz-caption">4 comentários</span>
            </div>
            <AvatarStack people={TIME.slice(0, 3)} />
          </div>
          <div className="vz-card__body">
            <div className="vz-thread">
              <div className="vz-thread__day"><span>14 de abril</span></div>
              <Mensagem quem="Cynthia Almeida" hora="10:23">
                Subi a primeira versão do carrossel. A capa ainda está com o texto provisório.
              </Mensagem>
              <Mensagem quem="Phedro Borges" hora="10:25" minha>
                Boa. Troca a capa por &ldquo;Wi-Fi seguro em casa&rdquo; e já pode mandar pra revisão.
              </Mensagem>
              <Mensagem quem="Erika Iorrana" hora="11:02">
                Ajustei e mudei a etapa para <b>Revisão</b>.
              </Mensagem>
            </div>
          </div>
          <div className="vz-card__foot" style={{ display: "block" }}>
            <div className="vz-composer">
              <textarea rows={2} placeholder="Escreva um comentário… use @ para chamar alguém" />
              <div className="vz-composer__bar">
                <IconButton size="sm" bare aria-label="Anexar"><Paperclip size={15} /></IconButton>
                <IconButton size="sm" bare aria-label="Emoji"><Smile size={15} /></IconButton>
                <IconButton size="sm" bare aria-label="Link"><Link2 size={15} /></IconButton>
                <Button variant="primary" size="sm"><Send size={14} />Comentar</Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="ds-demo">
          <div className="ds-demo__stage ds-demo__stage--block">
            <div className="ds-col" style={{ gap: 14 }}>
              <span className="ds-label">Lista de conversas</span>
              {CONVERSAS.map((conversa) => {
                const quem = pessoa(conversa.nome);
                return (
                  <button key={conversa.nome} className="vz-nav-item" style={{ height: 52, background: conversa.nao ? "var(--vz-panel-active)" : undefined }}>
                    <Avatar name={quem.name} src={quem.src} presence={conversa.presenca} />
                    <span style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 620, color: "var(--vz-text)" }}>{quem.name}</span>
                      <span className="vz-truncate" style={{ fontSize: 11, color: "var(--vz-text-faint)" }}>{conversa.ultima}</span>
                    </span>
                    <span style={{ display: "grid", gap: 4, justifyItems: "end" }}>
                      <span style={{ fontSize: 10, color: "var(--vz-text-faint)" }}>{conversa.hora}</span>
                      {conversa.nao > 0 && <Count variant="brand">{conversa.nao}</Count>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="ds-demo__note">
            A conversa não lida usa <b>fundo</b>{" "}e contador, nunca negrito no texto: negrito muda a largura da linha e
            faz a lista inteira tremer quando alguém responde.
          </p>
        </div>
      </div>
    </section>
  );
}

function Mensagem({ quem, hora, minha, children }: { quem: string; hora: string; minha?: boolean; children: React.ReactNode }) {
  const autor = pessoa(quem);
  return (
    <div className={`vz-msg${minha ? " vz-msg--mine" : ""}`}>
      <Avatar name={autor.name} src={autor.src} size="sm" />
      <div className="vz-msg__body">
        <div className="vz-msg__meta">
          <strong>{minha ? "Você" : autor.name}</strong>
          <span>{hora}</span>
        </div>
        <div className="vz-msg__bubble">{children}</div>
      </div>
    </div>
  );
}
