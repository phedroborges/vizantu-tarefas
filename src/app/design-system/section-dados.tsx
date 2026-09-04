"use client";

import * as React from "react";
import {
  ChevronLeft, ChevronRight, Ellipsis, Filter, MessageSquare, Paperclip, Plus,
  RotateCcw, Settings2 } from "lucide-react";
import { Avatar, Button, Card, Count, Dot, IconButton, Progress, SearchInput, Tabs } from "@/components/vz";
import { ColunaHeader, useColunasRedimensionaveis, type ColunaDef } from "@/components/vz/table";
import { Due, Stage } from "@/components/vz/stage";
import { CONTEUDOS, ETAPAS, pessoa, type Conteudo } from "./data";
import { TagFormato } from "./formato";

/* ---------- 08 · Tabela ---------- */

const COLUNAS: ColunaDef[] = [
  { key: "titulo", label: "Tarefa", largura: 320, min: 160 },
  { key: "formato", label: "Formato", largura: 132, min: 110 },
  { key: "dono", label: "Responsável", largura: 168, min: 120 },
  { key: "prazo", label: "Entrega", largura: 124, min: 100 },
  { key: "etapa", label: "Etapa", largura: 190, min: 150 },
  { key: "acoes", label: "", largura: 52, min: 52 },
];

export function SecaoTabela() {
  const [aba, setAba] = React.useState<"todas" | "minhas" | "atrasadas">("todas");
  const { larguras, arrastando, iniciarArrasto, redefinir } = useColunasRedimensionaveis("tarefas", COLUNAS);

  return (
    <section className="ds-section" id="tabela">
      <header className="ds-section__head">
        <span className="vz-eyebrow">08 · Dados</span>
        <h2 className="vz-h1">Tabela</h2>
        <p className="vz-body">
          Uma tabela para o produto inteiro — tarefas, conteúdos do plano, contratos, membros. Sem borda vertical,
          cabeçalho miúdo em caixa alta, linha inteira clicável e ações só no hover. Quatro regras firmadas nesta
          rodada: <b>o título nunca quebra em duas linhas</b>{" "}(trunca, e a coluna é arrastável), <b>formato sempre com
          ícone</b>, <b>etapa com anel de progresso</b>{" "}e <b>atraso não é tag</b>.
        </p>
      </header>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {/* Abas e controles no MESMO bloco: aba é o recorte dos dados,
            controle é o que se faz com o recorte. Antes as abas viviam num
            andar próprio, espremidas contra a busca. */}
        <div className="vz-tablebar">
          <div className="vz-tablebar__tabs">
            <Tabs
              value={aba}
              onChange={setAba}
              tabs={[{ value: "todas", label: "Todas", count: 148 }, { value: "minhas", label: "Minhas", count: 12 }, { value: "atrasadas", label: "Atrasadas", count: 2 }]}
            />
          </div>
          <div className="vz-tablebar__controls">
            <div className="vz-toolbar__search"><SearchInput placeholder="Buscar tarefa…" shortcut={null} size="sm" /></div>
            <Button variant="secondary" size="sm"><Filter size={14} />Filtros<Count variant="brand">2</Count></Button>
            <div className="vz-toolbar__spacer" />
            <IconButton size="sm" aria-label="Redefinir larguras" onClick={redefinir}><RotateCcw size={14} /></IconButton>
            <IconButton size="sm" aria-label="Colunas"><Settings2 size={14} /></IconButton>
            {/* "Conteúdo" só existe dentro de um plano. Aqui é a lista geral
                do time, e nem toda tarefa é um conteúdo. */}
            <Button variant="primary" size="sm"><Plus size={14} />Nova tarefa</Button>
          </div>
        </div>

        <div className="vz-table-wrap">
          <table className="vz-table vz-table--fixed" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                {COLUNAS.map((coluna) => (
                  <ColunaHeader
                    key={coluna.key}
                    coluna={coluna}
                    largura={larguras[coluna.key] ?? coluna.largura}
                    arrastando={arrastando === coluna.key}
                    onArrastar={iniciarArrasto}
                    onRedefinir={redefinir}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {CONTEUDOS.map((item) => <LinhaTarefa key={item.id} item={item} />)}
            </tbody>
          </table>
        </div>

        <div className="vz-pagination">
          <span>1–7 de 148 tarefas</span>
          <div className="ds-row" style={{ gap: 6 }}>
            <IconButton size="sm" aria-label="Anterior"><ChevronLeft size={14} /></IconButton>
            <IconButton size="sm" aria-label="Próxima"><ChevronRight size={14} /></IconButton>
          </div>
        </div>
      </Card>

      <div className="ds-grid ds-grid--2">
        <div className="ds-demo">
          <p className="ds-demo__note" style={{ padding: "14px 16px" }}>
            <b>Arraste a divisória entre dois cabeçalhos</b>{" "}para mudar a largura — o cursor vira seta dupla ao chegar
            perto. Duplo clique devolve o padrão, e o botão de desfazer na barra redefine tudo. A largura salva sozinha
            e volta no próximo acesso.<br /><br />
            Aqui na vitrine ela grava em <code>localStorage</code>. No app vai para o mesmo <code>/api/preferences</code>{" "}
            que já guarda quais colunas ficam visíveis: é a mesma preferência de tabela, por usuário, e não faz sentido
            morar em dois lugares.
          </p>
        </div>
        <div className="ds-demo">
          <p className="ds-demo__note" style={{ padding: "14px 16px" }}>
            <b>Agrupar por formato saiu daqui.</b>{" "}Na lista geral do time convivem tarefas de vários clientes e nem
            toda tarefa é um conteúdo — o cabeçalho &ldquo;CARROSSEL&rdquo; no meio da lista não queria dizer nada.
            O agrupamento por formato continua existindo, mas só <b>dentro do plano do cliente</b>{" "}(seção 14), que é
            onde ele responde uma pergunta real: quantos carrosséis eu ainda devo neste mês.
          </p>
        </div>
      </div>
    </section>
  );
}

function LinhaTarefa({ item }: { item: Conteudo }) {
  const dono = pessoa(item.dono);
  return (
    <tr>
      <td>
        {/* title no elemento: truncar não pode custar o acesso ao texto inteiro. */}
        <span className="vz-table__primary" title={item.titulo}>{item.titulo}</span>
        <span className="vz-table__sub" title={item.pacote}>{item.pacote}</span>
      </td>
      <td><TagFormato formato={item.formato} /></td>
      <td>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <Avatar name={dono.name} src={dono.src} size="xs" />
          <span className="vz-caption vz-truncate">{dono.name.split(" ")[0]}</span>
        </span>
      </td>
      <td><Due date={item.prazo} diasDeAtraso={item.atraso} /></td>
      <td><Stage etapa={item.etapa} etapas={ETAPAS} /></td>
      <td className="vz-table__actions">
        <IconButton size="sm" bare aria-label="Mais"><Ellipsis size={14} /></IconButton>
      </td>
    </tr>
  );
}

/* ---------- 09 · Board ---------- */

const COLUNAS_BOARD = [
  { titulo: "Aguardando texto", tone: "blue" as const, itens: [0, 5] },
  { titulo: "Em criação", tone: "amber" as const, itens: [1, 2] },
  { titulo: "Para aprovação", tone: "green" as const, itens: [3] },
  { titulo: "Aprovado", tone: "green" as const, itens: [4] },
];

export function SecaoBoard() {
  return (
    <section className="ds-section" id="board">
      <header className="ds-section__head">
        <span className="vz-eyebrow">09 · Dados</span>
        <h2 className="vz-h1">Board</h2>
        <p className="vz-body">
          Mesmos dados da tabela, arrumados pela etapa. A coluna é um trilho tracejado e o cartão é o painel — a coluna
          vazia já diz &ldquo;arrasta aqui&rdquo; sem texto explicando. Agora com ícone no formato e a foto do membro
          no lugar das iniciais.
        </p>
      </header>

      <div className="ds-demo">
        <div className="ds-demo__stage ds-demo__stage--block">
          <div className="vz-board">
            {COLUNAS_BOARD.map((coluna) => (
              <div className="vz-board__col" key={coluna.titulo}>
                <div className="vz-board__head">
                  <Dot tone={coluna.tone} />
                  <strong>{coluna.titulo}</strong>
                  <Count>{coluna.itens.length}</Count>
                  <IconButton size="sm" bare aria-label="Adicionar"><Plus size={14} /></IconButton>
                </div>
                {coluna.itens.map((indice) => {
                  const item = CONTEUDOS[indice];
                  const dono = pessoa(item.dono);
                  return (
                    <article className="vz-board-card" key={item.id}>
                      <div className="vz-board-card__top">
                        <div className="vz-board-card__title">
                          <strong>{item.titulo}</strong>
                          <span>{item.pacote}</span>
                        </div>
                        <IconButton size="sm" bare aria-label="Mais"><Ellipsis size={13} /></IconButton>
                      </div>
                      <Progress value={indice + 3} total={10} label="Progresso" tone={coluna.tone === "green" ? "green" : coluna.tone === "amber" ? "amber" : undefined} />
                      <div className="vz-board-card__foot">
                        <TagFormato formato={item.formato} />
                        <div className="vz-board-card__meta">
                          {item.comentarios > 0 && <span><MessageSquare size={12} />{item.comentarios}</span>}
                          {item.anexos > 0 && <span><Paperclip size={12} />{item.anexos}</span>}
                          <Avatar name={dono.name} src={dono.src} size="xs" />
                        </div>
                      </div>
                    </article>
                  );
                })}
                <div className="vz-board__drop">Solte uma tarefa aqui</div>
              </div>
            ))}
          </div>
        </div>
        <p className="ds-demo__note">
          O cartão carrega só o que se decide sem abrir: título, pacote, progresso, formato, quem é o dono. Prazo e
          etapa já estão ditos pela posição na coluna.
        </p>
      </div>
    </section>
  );
}
