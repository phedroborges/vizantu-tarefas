"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Tag } from "@/components/vz";
import { Logo } from "@/components/vz/logo";
import { SecaoCor, SecaoForma, SecaoTipografia } from "./section-fundamentos";
import { SecaoAcoes, SecaoEntradas, SecaoSinalizacao, SecaoSuperficies } from "./section-componentes";
import { SecaoBoard, SecaoTabela } from "./section-dados";
import { SecaoCalendario } from "./section-calendario";
import { SecaoGraficos } from "./section-graficos";
import { SecaoConversa } from "./section-conversa";
import { SecaoNavegacao, SecaoPacote, SecaoPlano } from "./section-aplicacao";

const INDICE = [
  { grupo: "Fundamentos", itens: [["01", "Cor", "cor"], ["02", "Tipografia", "tipografia"], ["03", "Forma", "forma"]] },
  { grupo: "Componentes", itens: [["04", "Ações", "acoes"], ["05", "Entradas", "entradas"], ["06", "Etapas e tags", "sinalizacao"], ["07", "Superfícies", "superficies"]] },
  { grupo: "Dados", itens: [["08", "Tabela", "tabela"], ["09", "Board", "board"], ["10", "Calendário", "calendario"], ["11", "Gráficos", "graficos"], ["12", "Conversa", "conversa"]] },
  { grupo: "Aplicação", itens: [["13", "Navegação", "navegacao"], ["14", "A tela do plano", "plano"], ["15", "Dentro do pacote", "pacote"]] },
] as const;

export default function DesignSystemPage() {
  const [tema, setTema] = React.useState<"light" | "dark">("light");

  return (
    <div className="vz-root" data-vz-theme={tema}>
      <div className="ds-shell">
        <aside className="ds-index">
          <div className="ds-index__brand">
            <Logo height={19} />
            <span>Design System</span>
          </div>
          {INDICE.map((bloco) => (
            <div key={bloco.grupo}>
              <div className="vz-sidebar__group">{bloco.grupo}</div>
              <nav className="ds-index__nav">
                {bloco.itens.map(([numero, rotulo, alvo]) => (
                  <a key={alvo} href={`#${alvo}`}>
                    <span className="ds-index__num">{numero}</span>
                    {rotulo}
                  </a>
                ))}
              </nav>
            </div>
          ))}
        </aside>

        <main className="ds-main">
          <div className="ds-controls">
            <span className="vz-caption">Vizantu · sistema de interface</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <div className="vz-segmented">
                <button type="button" aria-pressed={tema === "light"} onClick={() => setTema("light")}><Sun size={13} />Claro</button>
                <button type="button" aria-pressed={tema === "dark"} onClick={() => setTema("dark")}><Moon size={13} />Escuro</button>
              </div>
            </div>
          </div>

          <div className="ds-inner">
            <header className="ds-hero">
              <span className="vz-eyebrow">Em produção · base do app</span>
              <h1 className="vz-display">O sistema de interface da Vizantu</h1>
              <p className="vz-body" style={{ maxWidth: 720, fontSize: 16 }}>
                Um vocabulário único de cor, forma e componente para todo o produto. A partir daqui, nenhuma tela
                escolhe cor, raio, sombra ou tamanho de fonte na mão — escolhe um token. Tabela, calendário, gráfico,
                dropdown, campo, botão, board, select e tag passam a ter <b>um</b>{" "}desenho, e a tela do plano deixa de
                ser um dialeto próprio ao lado da tela de tarefas.
              </p>
              <div className="ds-hero__meta">
                <Tag tone="violet" size="lg">15 seções</Tag>
                <Tag outline size="lg">Claro e escuro</Tag>
                <Tag outline size="lg">Mona Sans</Tag>
                <Tag outline size="lg">Tokens em vizantu.css</Tag>
                <Tag outline size="lg">Primitivas em components/vz</Tag>
              </div>
              <div className="vz-callout vz-callout--brand" style={{ maxWidth: 720 }}>
                <div>
                  <b>Segunda rodada.</b>{" "}Mona Sans no lugar da Geist, botão de aprovar em verde, seletor com ícone por
                  opção, foto de perfil no lugar das iniciais, etapa com anel de progresso, atraso fora das tags,
                  coluna de tabela arrastável com largura salva, cartão configurável no calendário, gráfico de carga
                  no lugar da rosca — e duas telas novas: a <b>visão de aprovação</b>{" "}(seção 14) e o{" "}
                  <b>miolo do pacote de produção</b>{" "}(seção 15).
                </div>
              </div>
            </header>

            <SecaoCor />
            <SecaoTipografia />
            <SecaoForma />
            <SecaoAcoes />
            <SecaoEntradas />
            <SecaoSinalizacao />
            <SecaoSuperficies />
            <SecaoTabela />
            <SecaoBoard />
            <SecaoCalendario />
            <SecaoGraficos />
            <SecaoConversa />
            <SecaoNavegacao />
            <SecaoPlano />
            <SecaoPacote />

            <footer className="ds-section" style={{ paddingTop: 32, borderTop: "1px solid var(--vz-line)" }}>
              <h2 className="vz-h2">Onde o sistema já está, e o que falta</h2>
              <p className="vz-body" style={{ maxWidth: 720 }}>
                A migração foi feita pela raiz, não tela a tela: os tokens subiram para o{" "}<code>:root</code>{" "}e cada
                nome de variável do CSS antigo passou a apontar para o token equivalente do sistema. Toda regra que já
                dizia{" "}<code>var(--line)</code>{" "}continuou dizendo — e ganhou a cor nova de graça.
              </p>
              <ol className="vz-body" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 9, maxWidth: 720 }}>
                <li><b>Feito:</b>{" "}tokens no <code>:root</code>, Mona Sans, tema claro/escuro com troca na barra lateral.</li>
                <li><b>Feito:</b>{" "}barra lateral e login acompanhando o tema, com a logo em SVG inline.</li>
                <li><b>Feito:</b>{" "}etapa com anel de progresso e tinte suave, na tela de tarefas e na do plano.</li>
                <li><b>Feito:</b>{" "}tela do plano reconstruída — cabeçalho com o estado, fluxo em faixa, abas de visão e a aprovação como uma delas.</li>
                <li><b>Falta:</b>{" "}trocar as regras da ponte pelos tokens diretos, tela a tela, até o bloco de compatibilidade poder morrer.</li>
                <li><b>Feito:</b>{" "}board no plano (arrastar entre colunas muda a etapa), colunas arrastáveis na tabela de tarefas com a largura salva na conta, e o miolo do pacote como tela de verdade em{" "}<code>/planos/[id]/pacote/[pacoteId]</code>.</li>
                <li><b>Falta:</b>{" "}tabela de tarefas em board, e o portal do cliente ganhar o mesmo tratamento estrutural que o plano ganhou.</li>
              </ol>
              <p className="vz-caption" style={{ maxWidth: 720 }}>
                As seções 14 e 15 deixaram de ser maquete: as duas viraram tela de verdade no app.
              </p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
