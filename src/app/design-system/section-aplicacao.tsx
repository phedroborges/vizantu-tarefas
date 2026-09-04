"use client";

import * as React from "react";
import {
  BookOpen, Calendar, Camera, Check, ChevronRight, CircleAlert, Clapperboard, Ellipsis, FileText,
  Filter, Folder, Home, LayoutGrid, Link2, List, LogOut, MapPin, MessageSquare, Paperclip, Plus,
  Search, Send, Settings2, Sparkles, Users, Video
} from "lucide-react";
import {
  Avatar, AvatarStack, Button, Callout, Card, Count, IconButton, Progress, SearchInput,
  Segmented, Tabs, Tag
} from "@/components/vz";
import { Due, Stage } from "@/components/vz/stage";
import { Logo } from "@/components/vz/logo";
import { CONTEUDOS, ETAPAS, PACOTES, TIME, pessoa, type Conteudo } from "./data";
import { IconeFormato, TagFormato } from "./formato";

const MENU = [
  { icone: <Home size={17} />, rotulo: "Dashboard" },
  { icone: <Folder size={17} />, rotulo: "Projetos" },
  { icone: <List size={17} />, rotulo: "Tarefas", contador: 12 },
  { icone: <Calendar size={17} />, rotulo: "Planos", ativo: true },
  { icone: <Sparkles size={17} />, rotulo: "Marcas" },
  { icone: <FileText size={17} />, rotulo: "Contratos" },
  { icone: <Users size={17} />, rotulo: "Membros" },
  { icone: <BookOpen size={17} />, rotulo: "Conhecimento" },
];

/* ---------- 13 · Navegação ---------- */

export function SecaoNavegacao() {
  return (
    <section className="ds-section" id="navegacao">
      <header className="ds-section__head">
        <span className="vz-eyebrow">13 · Componentes</span>
        <h2 className="vz-h1">Navegação</h2>
        <p className="vz-body">
          Uma barra só, que <b>acompanha o tema</b>: no claro ela é painel branco sobre fundo lilás; no escuro, painel
          escuro. É a mesma classe nos dois casos — quem troca é o token, não o componente. E a logo é SVG inline com o
          símbolo em roxo fixo e a palavra em <code>currentColor</code>, então ela serve nos dois temas sem trocar de
          arquivo.
        </p>
      </header>

      <div className="ds-compare">
        {([
          { tema: "light" as const, rotulo: "Tema claro" },
          { tema: "dark" as const, rotulo: "Tema escuro" },
        ]).map(({ tema, rotulo }) => (
          <div className="ds-compare__side" key={tema}>
            <header>
              <span className="ds-label">{rotulo}</span>
              <Tag outline>mesma classe</Tag>
            </header>
            {/* Aninhar um .vz-root com o outro tema é o que permite mostrar a
                barra escura dentro de uma página clara: os tokens moram na
                classe, então basta abrir um escopo novo. */}
            <div className="vz-root" data-vz-theme={tema} style={{ border: "1px solid var(--vz-line)", borderRadius: "var(--vz-r-md)", overflow: "hidden", background: "var(--vz-bg)" }}>
              <BarraLateral />
            </div>
          </div>
        ))}
      </div>

      <div className="ds-demo">
        <div className="ds-demo__stage ds-demo__stage--block" style={{ padding: 0 }}>
          <div className="vz-topbar">
            <div className="vz-crumb">
              <a href="#navegacao">Planos</a>
              <ChevronRight size={13} />
              <a href="#navegacao">Terranet</a>
              <ChevronRight size={13} />
              <b>Setembro 26</b>
            </div>
            <div className="vz-topbar__actions">
              <IconButton size="sm" aria-label="Buscar"><Search size={15} /></IconButton>
              <IconButton size="sm" aria-label="Comentários"><MessageSquare size={15} /></IconButton>
              <Button variant="primary" size="sm"><Plus size={14} />Conteúdo</Button>
              <Avatar name="Phedro Borges" src="/demo/avatares/phedro.svg" size="sm" />
            </div>
          </div>
        </div>
        <p className="ds-demo__note">
          Barra de topo: migalha à esquerda dizendo onde se está, ações à direita. Ela não repete o título da tela.
        </p>
      </div>
    </section>
  );
}

function BarraLateral() {
  return (
    <div className="vz-sidebar" style={{ width: "100%", minHeight: 420 }}>
      <div className="vz-sidebar__brand">
        <Logo height={21} />
      </div>
      <div>
        <div className="vz-sidebar__group">Central de tarefas</div>
        <nav className="vz-sidebar__nav">
          {MENU.map((item) => (
            <button key={item.rotulo} className="vz-nav-item" aria-current={item.ativo ? "page" : undefined}>
              {item.icone}
              {item.rotulo}
              {item.contador && <Count>{item.contador}</Count>}
            </button>
          ))}
        </nav>
      </div>
      <div className="vz-sidebar__foot">
        <div className="vz-sidebar__user">
          <Avatar name="Phedro Borges" src="/demo/avatares/phedro.svg" size="sm" />
          <div>
            <strong>Phedro</strong>
            <span>phedro@vizantu.com.br</span>
          </div>
          <IconButton size="sm" bare aria-label="Sair" style={{ marginLeft: "auto" }}><LogOut size={14} /></IconButton>
        </div>
      </div>
    </div>
  );
}

/* ---------- 14 · A tela do plano ---------- */

type AbaPlano = "conteudos" | "calendario" | "board" | "aprovacao";

export function SecaoPlano() {
  const [aba, setAba] = React.useState<AbaPlano>("conteudos");
  const [visao, setVisao] = React.useState<"lista" | "grade">("lista");

  return (
    <section className="ds-section" id="plano">
      <header className="ds-section__head">
        <span className="vz-eyebrow">14 · Aplicação</span>
        <h2 className="vz-h1">A tela do plano</h2>
        <p className="vz-body">
          A mesma informação de hoje, arrumada pelas regras das seções anteriores. O cabeçalho carrega o estado do
          plano, o fluxo de aprovação vira uma faixa, e a lista ganha <b>abas de visão</b>: tabela, calendário, board e
          aprovação da mesma informação — do mesmo jeito que a tela de tarefas. Clique nas abas.
        </p>
      </header>

      <div className="ds-frame">
        <div className="ds-frame__body">
          <BarraLateral />
          <div className="ds-frame__canvas">
            <div className="vz-pagehead">
              <div className="vz-pagehead__text">
                <span className="vz-eyebrow">Terranet · Plano mensal</span>
                <h1 className="vz-h1">Setembro de 2026</h1>
                <div className="ds-row" style={{ gap: 7 }}>
                  <Tag tone="amber">Em produção</Tag>
                  <Tag outline>22 conteúdos</Tag>
                  <Tag outline>6 aprovados</Tag>
                  <AvatarStack people={TIME.slice(0, 3)} />
                </div>
              </div>
              <div className="vz-pagehead__actions">
                <Button variant="secondary" size="sm"><Link2 size={14} />Link do cliente</Button>
                <Button variant="primary" size="sm"><Plus size={14} />Novo conteúdo</Button>
              </div>
            </div>

            <Card tint>
              <div style={{ display: "grid", gap: 14, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className="vz-eyebrow" style={{ margin: 0 }}>Fluxo do cliente · rodada 1</span>
                  <Tag tone="violet">Aprovação de texto</Tag>
                  <span className="vz-caption" style={{ marginLeft: "auto" }}>14 de 22 revisados</span>
                </div>
                <Progress value={14} total={22} label="Textos aprovados pelo cliente" />
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* Verde porque a ação é AVANÇAR na esteira, não criar. */}
                  <Button variant="success" size="sm"><Send size={14} />Enviar textos pendentes</Button>
                  <Button variant="secondary" size="sm" disabled>Enviar criativos</Button>
                  <span className="vz-caption">Faltam 8 textos aprovados e 22 links de material.</span>
                </div>
              </div>
            </Card>

            <PacotesDoPlano />

            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div className="vz-tablebar">
                <div className="vz-tablebar__tabs">
                  <Tabs
                    value={aba}
                    onChange={setAba}
                    tabs={[
                      { value: "conteudos", label: "Conteúdos", count: 22 },
                      { value: "calendario", label: "Calendário" },
                      { value: "board", label: "Board" },
                      { value: "aprovacao", label: "Aprovação", count: 8 },
                    ]}
                  />
                </div>
                {aba === "conteudos" && (
                  <div className="vz-tablebar__controls">
                    <div className="vz-toolbar__search"><SearchInput placeholder="Buscar no plano…" shortcut={null} size="sm" /></div>
                    <Button variant="secondary" size="sm"><Filter size={14} />Filtros</Button>
                    <div className="vz-toolbar__spacer" />
                    <Segmented
                      size="sm"
                      value={visao}
                      onChange={setVisao}
                      options={[{ value: "lista", label: "Lista", icon: <List size={13} /> }, { value: "grade", label: "Grade", icon: <LayoutGrid size={13} /> }]}
                    />
                    <IconButton size="sm" aria-label="Colunas"><Settings2 size={14} /></IconButton>
                  </div>
                )}
              </div>

              {aba === "conteudos" && <ListaDoPlano />}
              {aba === "aprovacao" && <VisaoAprovacao />}
              {(aba === "calendario" || aba === "board") && (
                <div className="vz-empty">
                  <span className="vz-empty__icon">{aba === "calendario" ? <Calendar size={20} /> : <LayoutGrid size={20} />}</span>
                  <h3>{aba === "calendario" ? "O calendário da seção 10 entra aqui" : "O board da seção 09 entra aqui"}</h3>
                  <p>São os mesmos 22 conteúdos, sem nenhum componente novo — por isso não estão duplicados nesta página.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <div className="ds-grid ds-grid--2">
        <Card className="ds-compare__side">
          <header><Tag>Hoje</Tag></header>
          <ul className="vz-small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 7 }}>
            <li>Cinco blocos empilhados numa coluna única de ~2.700px de altura.</li>
            <li>Calendário e lista mostram os mesmos 22 itens duas vezes, um embaixo do outro.</li>
            <li>Doze cores de etapa sólidas competindo em cada linha.</li>
            <li>Adição de conteúdo espremida entre a lista e um select solto.</li>
            <li>Nada em comum com a tela de tarefas, que o time usa o dia inteiro.</li>
          </ul>
        </Card>
        <Card className="ds-compare__side">
          <header><Tag tone="violet">Proposta</Tag></header>
          <ul className="vz-small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 7 }}>
            <li>Cabeçalho com o estado do plano visível sem rolar.</li>
            <li>Fluxo de aprovação em faixa, com a barra dizendo o que falta.</li>
            <li>Uma lista só, em abas: tabela, calendário, board e aprovação.</li>
            <li>Etapa com anel de progresso; formato com ícone; atraso fora das tags.</li>
            <li>Mesma tabela, mesma toolbar e mesmas tags da tela de tarefas.</li>
          </ul>
        </Card>
      </div>
    </section>
  );
}

function PacotesDoPlano() {
  return (
    <Card>
      <div className="vz-card__head">
        <div className="vz-card__title">
          <h3 className="vz-h3">Pacotes de produção</h3>
          <span className="vz-caption">Como as entregas se agrupam para gravar e editar</span>
        </div>
        <Button variant="ghost" size="sm"><Plus size={14} />Novo pacote</Button>
      </div>
      <div className="vz-card__body" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(214px, 1fr))" }}>
        {PACOTES.map((pacote) => (
          <article key={pacote.id} className="vz-card vz-card--interactive" style={{ padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <strong className="vz-truncate" style={{ fontSize: 13, fontWeight: 620 }} title={pacote.nome}>{pacote.nome}</strong>
                <span className="vz-caption" style={{ fontSize: 11 }}>{pacote.prontos} de {pacote.itens} prontos</span>
              </div>
              <IconeFormato formato={pacote.formato} size={15} />
            </div>
            <Progress value={pacote.prontos} total={pacote.itens} thin tone={pacote.prontos === pacote.itens ? "green" : undefined} />
            <div className="ds-row" style={{ gap: 6 }}>
              {pacote.captacao
                ? <Tag tone="amber" icon={<Camera size={11} />}>Captação {pacote.captacao.data.split(" ")[0]}</Tag>
                : <Tag>Direto pra criação</Tag>}
              <Tag outline>{pacote.prazo}</Tag>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

function ListaDoPlano() {
  return (
    <>
      <div className="vz-table-wrap">
        <table className="vz-table vz-table--fixed" style={{ minWidth: 780 }}>
          <thead>
            <tr>
              <th style={{ width: "38%" }}>Conteúdo</th>
              <th style={{ width: 128 }}>Formato</th>
              <th style={{ width: 150 }}>Responsável</th>
              <th style={{ width: 118 }}>Entrega</th>
              <th style={{ width: 186 }}>Etapa</th>
              <th style={{ width: 48 }} />
            </tr>
          </thead>
          <tbody>
            {/* Agrupar por formato SÓ faz sentido aqui, dentro do plano do
                cliente: aqui ele responde "quantos carrosséis eu ainda devo
                neste mês". Na lista geral de tarefas não responde nada. */}
            {(["Carrossel", "Estático", "Reels"] as const).map((formato) => {
              const doFormato = CONTEUDOS.filter((item) => item.formato === formato);
              return (
                <React.Fragment key={formato}>
                  <tr className="vz-table__group">
                    <td colSpan={6}>
                      <span><IconeFormato formato={formato} size={11} />{formato}<Count>{doFormato.length}</Count></span>
                    </td>
                  </tr>
                  {doFormato.map((item) => <LinhaDoPlano key={item.id} item={item} />)}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="vz-card__foot">
        <Button variant="ghost" size="sm"><Plus size={14} />Adicionar conteúdo</Button>
        <span className="vz-caption">22 conteúdos · 6 aprovados · 2 atrasados</span>
      </div>
    </>
  );
}

function LinhaDoPlano({ item }: { item: Conteudo }) {
  const dono = pessoa(item.dono);
  return (
    <tr>
      <td>
        <span className="vz-table__primary" title={item.titulo}>{item.titulo}</span>
        <span className="vz-table__sub">{item.pacote}</span>
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

/* ---------- A visão de Aprovação ---------- */

// O que é a aba "Aprovação": é a MESMA lista de conteúdos, mas arrumada pela
// resposta do cliente em vez de pela etapa interna. As outras três abas
// respondem "como está o nosso trabalho"; esta responde "o que o cliente já
// respondeu e o que está parado esperando ele" — que é a pergunta que hoje só
// dá pra responder abrindo o link do cliente e conferindo item por item.
const RESPOSTAS = [
  {
    chave: "ajuste",
    titulo: "Pediu ajuste",
    tone: "amber" as const,
    icone: <CircleAlert size={14} />,
    descricao: "O cliente respondeu e quer mudança. É a fila que trava a rodada.",
    itens: [
      { id: "c1", quando: "há 2 horas", recado: "Trocar a capa: o texto está falando de plano empresarial e o público desse post é residencial." },
      { id: "c3", quando: "ontem", recado: "Pode manter, só tirar a menção ao concorrente no slide 4." },
    ]
  },
  {
    chave: "aguardando",
    titulo: "Aguardando o cliente",
    tone: "blue" as const,
    icone: <Send size={14} />,
    descricao: "Enviado, sem resposta ainda. Passou de 3 dias, vira cobrança.",
    itens: [
      { id: "c2", quando: "enviado há 4 dias", recado: null },
      { id: "c6", quando: "enviado há 1 dia", recado: null },
    ]
  },
  {
    chave: "aprovado",
    titulo: "Aprovado pelo cliente",
    tone: "green" as const,
    icone: <Check size={14} />,
    descricao: "Liberado para seguir na esteira.",
    itens: [
      { id: "c5", quando: "há 3 dias", recado: "Perfeito, pode publicar." },
      { id: "c4", quando: "há 5 dias", recado: null },
    ]
  },
];

function VisaoAprovacao() {
  return (
    <div style={{ display: "grid", gap: 18, padding: 18 }}>
      <Callout tone="brand" icon={<Sparkles size={15} />}>
        <b>Esta aba é a mesma lista, arrumada pela resposta do cliente.</b>{" "}As outras três respondem &ldquo;como está o
        nosso trabalho&rdquo;; esta responde &ldquo;o que o cliente já respondeu e o que está parado esperando
        ele&rdquo; — hoje isso só dá pra saber abrindo o link do cliente e conferindo item por item.
      </Callout>

      {RESPOSTAS.map((grupo) => (
        <div key={grupo.chave} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span className={`vz-tag vz-tag--${grupo.tone} vz-tag--lg`}>{grupo.icone}<span>{grupo.titulo}</span></span>
            <Count>{grupo.itens.length}</Count>
            <span className="vz-caption" style={{ marginLeft: 4 }}>{grupo.descricao}</span>
          </div>

          {grupo.itens.map((entrada) => {
            const item = CONTEUDOS.find((conteudo) => conteudo.id === entrada.id)!;
            const dono = pessoa(item.dono);
            return (
              <article key={entrada.id} className="vz-card" style={{ padding: 14, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <TagFormato formato={item.formato} />
                  <strong className="vz-truncate" style={{ fontSize: 13, fontWeight: 620, flex: 1, minWidth: 120 }}>{item.titulo}</strong>
                  <span className="vz-caption">{entrada.quando}</span>
                  <Avatar name={dono.name} src={dono.src} size="xs" />
                </div>

                {/* O recado do cliente vem como balão de conversa, e não como
                    texto solto: é a mesma peça da seção 12, então quem lê
                    reconhece na hora que aquilo foi alguém que escreveu. */}
                {entrada.recado && (
                  <div className="vz-msg">
                    <span className="vz-avatar vz-avatar--sm vz-avatar--c4"><span>TN</span></span>
                    <div className="vz-msg__body" style={{ maxWidth: "100%" }}>
                      <div className="vz-msg__meta"><strong>TerraNet</strong><span>{entrada.quando}</span></div>
                      <div className="vz-msg__bubble">{entrada.recado}</div>
                    </div>
                  </div>
                )}

                {grupo.chave === "ajuste" && (
                  <div className="ds-row" style={{ gap: 8 }}>
                    <Button variant="primary" size="sm">Abrir e ajustar</Button>
                    <Button variant="ghost" size="sm">Responder ao cliente</Button>
                  </div>
                )}
                {grupo.chave === "aguardando" && (
                  <div className="ds-row" style={{ gap: 8 }}>
                    <Button variant="secondary" size="sm"><Send size={13} />Cobrar resposta</Button>
                  </div>
                )}
                {grupo.chave === "aprovado" && (
                  <div className="ds-row" style={{ gap: 8 }}>
                    <Button variant="success-soft" size="sm"><Check size={13} />Avançar para criação</Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ---------- 15 · A tela de dentro do pacote ---------- */

export function SecaoPacote() {
  const pacote = PACOTES[0];
  const doPacote = CONTEUDOS.filter((item) => item.pacote === pacote.nome || item.formato === "Reels");

  return (
    <section className="ds-section" id="pacote">
      <header className="ds-section__head">
        <span className="vz-eyebrow">15 · Aplicação</span>
        <h2 className="vz-h1">Dentro de um pacote de produção</h2>
        <p className="vz-body">
          O pacote existe porque gravar cinco reels no mesmo dia é uma tarefa só, não cinco. Hoje ele é um cartãozinho
          na tela do plano e não abre em lugar nenhum — quem vai gravar não tem uma tela que responda{" "}
          <b>&ldquo;o que eu preciso ter na mão nessa captação, e já está tudo pronto?&rdquo;</b>. Esta é essa tela.
        </p>
      </header>

      <div className="ds-frame">
        <div className="ds-frame__body">
          <BarraLateral />
          <div className="ds-frame__canvas">
            <div className="vz-crumb" style={{ marginBottom: 4 }}>
              <a href="#pacote">Planos</a><ChevronRight size={13} />
              <a href="#pacote">Terranet</a><ChevronRight size={13} />
              <a href="#pacote">Setembro 26</a><ChevronRight size={13} />
              <b>{pacote.nome}</b>
            </div>

            <div className="vz-pagehead">
              <div className="vz-pagehead__text">
                <h1 className="vz-h1">{pacote.nome}</h1>
                <div className="ds-row" style={{ gap: 7 }}>
                  <TagFormato formato={pacote.formato} size="lg" />
                  <Tag tone="amber" size="lg" icon={<Camera size={12} />}>Exige captação</Tag>
                  <Tag outline size="lg">{pacote.itens} conteúdos</Tag>
                </div>
              </div>
              <div className="vz-pagehead__actions">
                <Button variant="secondary" size="sm"><Paperclip size={14} />Material bruto</Button>
                <Button variant="primary" size="sm"><Plus size={14} />Adicionar ao pacote</Button>
              </div>
            </div>

            {/* A ficha da captação. É o que o produtor precisa ter na mão. */}
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <FichaCampo icone={<Calendar size={16} />} tone="violet" rotulo="Data da captação" valor={pacote.captacao!.data} apoio="quinta-feira, 09h" />
              <FichaCampo icone={<MapPin size={16} />} tone="blue" rotulo="Local" valor={pacote.captacao!.local} apoio="chave com a recepção" />
              <FichaCampo icone={<Camera size={16} />} tone="amber" rotulo="Quem grava" valor={pacote.captacao!.responsavel} apoio="captação" foto />
              <FichaCampo icone={<Clapperboard size={16} />} tone="green" rotulo="Quem edita" valor={pacote.edicao} apoio="entrega até 18 set" foto />
            </div>

            {/* O bloqueio, dito antes da lista: sem texto aprovado não se grava. */}
            <Card>
              <div className="vz-card__head">
                <div className="vz-card__title">
                  <h3 className="vz-h3">Pronto para gravar?</h3>
                  <span className="vz-caption">Faltam 4 dias para a captação</span>
                </div>
                <Tag tone="amber" size="lg">2 pendências</Tag>
              </div>
              <div className="vz-card__body" style={{ display: "grid", gap: 12 }}>
                <Progress value={4} total={6} label="Itens da checklist" tone="amber" />
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    { texto: "Textos aprovados pelo cliente", estado: "pendente", detalhe: "4 de 6 aprovados" },
                    { texto: "Roteiros escritos e revisados", estado: "ok", detalhe: "6 de 6" },
                    { texto: "Locação confirmada", estado: "ok", detalhe: "confirmada em 02 set" },
                    { texto: "Equipamento reservado", estado: "ok", detalhe: "câmera + 2 lapelas" },
                    { texto: "Briefing enviado ao cliente", estado: "ok", detalhe: "enviado em 03 set" },
                    { texto: "Figurino e pauta com o entrevistado", estado: "pendente", detalhe: "sem resposta há 2 dias" },
                  ].map((linha) => (
                    <div key={linha.texto} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--vz-r-sm)", background: linha.estado === "ok" ? "transparent" : "var(--vz-amber-bg)" }}>
                      <span style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 999, flex: "none", background: linha.estado === "ok" ? "var(--vz-green-bg)" : "transparent", color: linha.estado === "ok" ? "var(--vz-green-ink)" : "var(--vz-amber-ink)" }}>
                        {linha.estado === "ok" ? <Check size={13} strokeWidth={3} /> : <CircleAlert size={15} />}
                      </span>
                      <span style={{ fontSize: 13, color: linha.estado === "ok" ? "var(--vz-text-soft)" : "var(--vz-amber-ink)", fontWeight: linha.estado === "ok" ? 400 : 600 }}>{linha.texto}</span>
                      <span className="vz-caption" style={{ marginLeft: "auto" }}>{linha.detalhe}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Os conteúdos do pacote, com o roteiro à mão. */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div className="vz-card__head">
                <div className="vz-card__title">
                  <h3 className="vz-h3">Conteúdos deste pacote</h3>
                  <span className="vz-caption">Na ordem de gravação — arraste para reordenar</span>
                </div>
                <Button variant="ghost" size="sm"><List size={14} />Ver roteiros</Button>
              </div>
              <div className="vz-table-wrap">
                <table className="vz-table vz-table--fixed" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>#</th>
                      <th style={{ width: "42%" }}>Conteúdo</th>
                      <th style={{ width: 156 }}>Responsável</th>
                      <th style={{ width: 176 }}>Etapa</th>
                      <th style={{ width: 132 }}>Roteiro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doPacote.slice(0, 5).map((item, indice) => {
                      const dono = pessoa(item.dono);
                      return (
                        <tr key={item.id}>
                          <td className="vz-mono" style={{ color: "var(--vz-text-faint)" }}>{String(indice + 1).padStart(2, "0")}</td>
                          <td><span className="vz-table__primary" title={item.titulo}>{item.titulo}</span></td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                              <Avatar name={dono.name} src={dono.src} size="xs" />
                              <span className="vz-caption vz-truncate">{dono.name.split(" ")[0]}</span>
                            </span>
                          </td>
                          <td><Stage etapa={item.etapa} etapas={ETAPAS} /></td>
                          <td>
                            {item.temLink
                              ? <Tag tone="green" icon={<Check size={11} />}>Pronto</Tag>
                              : <Tag tone="amber">Falta escrever</Tag>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="ds-demo">
        <p className="ds-demo__note" style={{ padding: "14px 16px" }}>
          <b>Nenhum componente novo foi inventado para esta tela.</b>{" "}Ela é migalha + cabeçalho de página + quatro
          fichas + cartão com barra de progresso + a mesma tabela das seções 08 e 14. É exatamente o que um design
          system tem que permitir: montar uma tela que não existia sem desenhar uma peça nova.
        </p>
      </div>
    </section>
  );
}

function FichaCampo({ icone, tone, rotulo, valor, apoio, foto }: { icone: React.ReactNode; tone: string; rotulo: string; valor: string; apoio: string; foto?: boolean }) {
  const quem = foto ? pessoa(valor) : null;
  return (
    <Card style={{ padding: 14, display: "grid", gap: 9 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={`vz-metric__icon vz-metric__icon--${tone}`} style={{ width: 30, height: 30, borderRadius: "var(--vz-r-sm)" }}>{icone}</span>
        <span className="ds-label">{rotulo}</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {quem?.src && <Avatar name={quem.name} src={quem.src} size="sm" />}
        <strong className="vz-truncate" style={{ fontSize: 13.5, fontWeight: 620 }} title={valor}>{valor}</strong>
      </span>
      <span className="vz-caption" style={{ fontSize: 11 }}>{apoio}</span>
    </Card>
  );
}
