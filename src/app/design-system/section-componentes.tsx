"use client";

import * as React from "react";
import {
  Bell, Calendar, Check, ChevronLeft, ChevronRight, CircleAlert, Copy,
  Ellipsis, Filter, Image as ImageIcon, LayoutGrid, List, Loader,
  PenLine, Plus, Send, Sparkles, Trash2, TriangleAlert
} from "lucide-react";
import {
  Avatar, AvatarStack, Button, Callout, Card, Check as Marca, Count, Delta, Dot, Field, IconButton,
  Input, Progress, SearchInput, Segmented, Switch, Tag, Textarea
} from "@/components/vz";
import { Picker, type PickerOption } from "@/components/vz/picker";
import { Due, Stage } from "@/components/vz/stage";
import { ETAPAS, PACOTES, TIME } from "./data";
import { IconeFormato, TagFormato } from "./formato";

/* ---------- 04 · Ações ---------- */

export function SecaoAcoes() {
  return (
    <section className="ds-section" id="acoes">
      <header className="ds-section__head">
        <span className="vz-eyebrow">04 · Componentes</span>
        <h2 className="vz-h1">Ações</h2>
        <p className="vz-body">
          Uma tela tem <b>uma</b>{" "}ação primária. Tudo que compete com ela vira secundária, suave ou fantasma — nessa
          ordem de peso. O botão de contraste existe para o caso raro em que a ação principal precisa saltar sobre um
          fundo já roxo.
        </p>
      </header>

      <div className="ds-demo">
        <div className="ds-demo__stage">
          <Button variant="primary"><Plus size={15} />Novo conteúdo</Button>
          <Button variant="secondary"><Filter size={15} />Filtros<Count>3</Count></Button>
          <Button variant="soft"><Sparkles size={15} />Gerar com IA</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="danger"><Trash2 size={14} />Excluir</Button>
          <Button variant="success"><Check size={15} />Enviar para aprovação</Button>
          <Button variant="contrast">Ação de contraste</Button>
        </div>
        <p className="ds-demo__note">
          <b>Roxo é a cor da marca</b>{" "}(criar, salvar) e <b>verde é a cor de aprovar</b> — o mesmo verde da etapa
          &ldquo;aprovado&rdquo; na tabela. Quem olha a tela entende &ldquo;enviar para aprovação&rdquo; antes de ler
          o rótulo, o que não acontecia com os dois botões roxos. Variantes, da mais pesada para a mais leve:{" "}
          <code>primary</code>, <code>success</code>, <code>contrast</code>, <code>secondary</code>,{" "}
          <code>soft</code>, <code>ghost</code>, <code>danger</code>.
        </p>
      </div>

      <div className="ds-grid ds-grid--2">
        <div className="ds-demo">
          <div className="ds-demo__stage">
            <Button variant="primary" size="sm">Pequeno</Button>
            <Button variant="primary">Médio</Button>
            <Button variant="primary" size="lg">Grande</Button>
            <Button variant="secondary" pill>Pílula</Button>
            <Button variant="primary" disabled>Desabilitado</Button>
            <Button variant="secondary"><Loader size={14} className="vz-spin" />Salvando…</Button>
          </div>
          <p className="ds-demo__note">
            Três alturas travadas em <code>--vz-h-sm/md/lg</code>{" "}(28 / 34 / 40px). É o que faz botão, campo e select
            fecharem alinhados na mesma toolbar.
          </p>
        </div>

        <div className="ds-demo">
          <div className="ds-demo__stage">
            <IconButton aria-label="Editar"><PenLine size={15} /></IconButton>
            <IconButton size="sm" aria-label="Mais"><Ellipsis size={14} /></IconButton>
            <IconButton size="lg" aria-label="Notificações"><Bell size={17} /></IconButton>
            <IconButton bare aria-label="Copiar"><Copy size={15} /></IconButton>
            <IconButton round aria-label="Adicionar"><Plus size={15} /></IconButton>
            <div className="vz-btn-group">
              <button className="vz-btn vz-btn--secondary vz-btn--sm"><List size={14} />Lista</button>
              <button className="vz-btn vz-btn--secondary vz-btn--sm"><LayoutGrid size={14} />Board</button>
              <button className="vz-btn vz-btn--secondary vz-btn--sm"><Calendar size={14} />Mês</button>
            </div>
          </div>
          <p className="ds-demo__note">
            Botão de ícone sempre quadrado na altura do irmão de texto. <code>bare</code>{" "}para dentro de linha de
            tabela, com moldura para toolbar.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- 05 · Entradas ---------- */

const OPCOES_PACOTE: PickerOption[] = PACOTES.map((pacote) => ({
  value: pacote.id,
  label: pacote.nome,
  sub: pacote.captacao ? `Exige captação · ${pacote.captacao.data}` : `Direto pra criação · entrega ${pacote.prazo}`,
  icon: <IconeFormato formato={pacote.formato} size={14} />,
  tone: pacote.formato === "Reels" ? "violet" : pacote.formato === "Carrossel" ? "blue" : "green",
  group: pacote.captacao ? "Com captação" : "Sem captação"
}));

const OPCOES_PESSOA: PickerOption[] = TIME.map((membro) => ({
  value: membro.name,
  label: membro.name,
  sub: membro.papel,
  icon: <img src={membro.src} alt="" width={26} height={26} style={{ borderRadius: 999, display: "block" }} />
}));

export function SecaoEntradas() {
  const [visao, setVisao] = React.useState<"lista" | "board" | "mes">("lista");
  const [pacote, setPacote] = React.useState<string | null>("p3");
  const [dono, setDono] = React.useState<string | null>("Cynthia Almeida");

  return (
    <section className="ds-section" id="entradas">
      <header className="ds-section__head">
        <span className="vz-eyebrow">05 · Componentes</span>
        <h2 className="vz-h1">Entradas</h2>
        <p className="vz-body">
          Todo campo tem a mesma moldura, o mesmo raio e o mesmo anel de foco roxo. O foco é o único momento em que a
          borda muda de cor. E <b>todo seletor de coisa tem ícone na opção</b>: num sistema onde pacote é vídeo,
          carrossel ou estático, o ícone é o que se lê antes do texto — por isso o seletor não é o{" "}
          <code>&lt;select&gt;</code>{" "}nativo, que não aceita ícone dentro da opção.
        </p>
      </header>

      <div className="ds-grid ds-grid--2">
        <div className="ds-demo">
          <div className="ds-demo__stage ds-demo__stage--grid" style={{ gap: 16 }}>
            <Field label="Título do conteúdo" hint="Aparece na lista, no calendário e para o cliente.">
              <Input defaultValue="Internet segura para crianças e idosos" />
            </Field>
            <div className="vz-field">
              <span className="vz-label">Pacote de produção</span>
              <Picker options={OPCOES_PACOTE} value={pacote} onChange={setPacote} />
              <span className="vz-hint">O ícone diz o formato; a segunda linha diz se o pacote exige captação.</span>
            </div>
            <div className="vz-field">
              <span className="vz-label">Responsável</span>
              <Picker options={OPCOES_PESSOA} value={dono} onChange={setDono} placeholder="Ninguém atribuído" />
            </div>
            <Field label="Prazo" error="A entrega não pode cair antes da captação.">
              <Input aria-invalid defaultValue="03/09/2026" />
            </Field>
          </div>
          <p className="ds-demo__note">
            Abra os dois seletores. Setas, Home/End, Enter e Esc funcionam como no nativo — trocar o{" "}
            <code>&lt;select&gt;</code>{" "}por um listbox próprio não pode custar o teclado. Erro fica <b>abaixo</b>{" "}do
            campo, nunca dentro do placeholder: placeholder some quando se digita.
          </p>
        </div>

        <div className="ds-demo">
          <div className="ds-demo__stage ds-demo__stage--grid" style={{ gap: 16 }}>
            <Field label="Busca global"><SearchInput placeholder="Buscar conteúdo, projeto ou pessoa…" /></Field>
            <Field label="Legenda"><Textarea rows={3} defaultValue="Sua internet pode estar ótima — o problema costuma ser o Wi-Fi." /></Field>
            <div className="ds-row">
              <Marca label="Exige captação" defaultChecked />
              <Marca label="Data fixa" />
              <Switch label="Visível ao cliente" defaultChecked />
            </div>
            <div className="ds-row">
              <Segmented
                value={visao}
                onChange={setVisao}
                options={[
                  { value: "lista", label: "Lista", icon: <List size={14} /> },
                  { value: "board", label: "Board", icon: <LayoutGrid size={14} /> },
                  { value: "mes", label: "Mês", icon: <Calendar size={14} /> },
                ]}
              />
            </div>
          </div>
          <p className="ds-demo__note">
            O segmentado é o padrão para trocar a <b>visão dos mesmos dados</b>. Para navegar entre conteúdos
            diferentes, usa-se aba.
          </p>
        </div>
      </div>

      <div className="ds-grid ds-grid--2">
        <div className="ds-demo">
          <div className="ds-demo__stage" style={{ justifyContent: "center" }}>
            <div className="vz-menu" style={{ width: 232 }}>
              <div className="vz-menu__label">Mudar etapa</div>
              <button className="vz-menu__item"><Dot tone="amber" />Em criação</button>
              <button className="vz-menu__item" role="menuitemradio" aria-checked><Dot tone="amber" />Revisão<Check size={14} className="vz-menu__end" /></button>
              <button className="vz-menu__item"><Dot tone="green" />Para aprovação</button>
              <div className="vz-menu__sep" />
              <button className="vz-menu__item"><Copy size={14} />Duplicar<span className="vz-menu__end vz-kbd">⌘D</span></button>
              <button className="vz-menu__item vz-menu__item--danger"><Trash2 size={14} />Excluir conteúdo</button>
            </div>
          </div>
          <p className="ds-demo__note">Menu suspenso: 30px de altura por item, ícone à esquerda, atalho ou marca à direita.</p>
        </div>

        <div className="ds-demo">
          <div className="ds-demo__stage" style={{ justifyContent: "center" }}>
            <Datepicker />
          </div>
          <p className="ds-demo__note">
            Seletor de data. Hoje ganha anel roxo fino; o dia escolhido é sólido. Um só desenho para prazo de conteúdo,
            vencimento de parcela e filtro de período.
          </p>
        </div>
      </div>
    </section>
  );
}

function Datepicker() {
  const dias = Array.from({ length: 35 }, (_, index) => index - 3);
  return (
    <div className="vz-datepicker">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <IconButton size="sm" bare aria-label="Mês anterior"><ChevronLeft size={15} /></IconButton>
        <strong style={{ fontSize: 13, fontWeight: 640 }}>Setembro 2026</strong>
        <IconButton size="sm" bare aria-label="Próximo mês"><ChevronRight size={15} /></IconButton>
      </div>
      <div className="vz-datepicker__grid">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((dia, index) => <span key={index}>{dia}</span>)}
        {dias.map((dia) => {
          const fora = dia < 1 || dia > 30;
          const rotulo = fora ? (dia < 1 ? 31 + dia : dia - 30) : dia;
          return (
            <button key={dia} role="gridcell" data-out={fora} data-today={dia === 4} aria-selected={dia === 11}>
              {rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 06 · Sinalização ---------- */

export function SecaoSinalizacao() {
  return (
    <section className="ds-section" id="sinalizacao">
      <header className="ds-section__head">
        <span className="vz-eyebrow">06 · Componentes</span>
        <h2 className="vz-h1">Etapas, tags, avatares e progresso</h2>
        <p className="vz-body">
          A esteira da Vizantu tem doze etapas em três grupos. Ela não cabe em doze cores diferentes: o grupo define a
          família (azul esperando terceiros, âmbar produzindo, verde entregue) e o rótulo diz a etapa exata. E agora a
          etapa carrega <b>um anel que vai fechando</b>{" "}conforme a tarefa anda — ninguém tem obrigação de saber que
          &ldquo;Revisão&rdquo; vem depois de &ldquo;Em criação&rdquo;. Problema é a única exceção: não fecha anel
          nenhum, porque não é ponto da esteira, é alerta.
        </p>
      </header>

      <div className="ds-demo">
        <div className="ds-demo__stage ds-demo__stage--block">
          {["Não iniciada", "Em andamento", "Feita"].map((grupo) => (
            <div key={grupo} style={{ marginBottom: 18 }}>
              <span className="ds-label" style={{ display: "block", marginBottom: 9 }}>{grupo}</span>
              <div className="ds-row" style={{ gap: 8 }}>
                {ETAPAS.filter((etapa) => etapa.grupo === grupo).map((etapa) => (
                  <Stage key={etapa.value} etapa={etapa.value} etapas={ETAPAS} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="ds-demo__note">
          O anel sai da <b>posição</b>{" "}da etapa na esteira, não de um número escrito na mão: mudar a ordem das etapas
          reajusta todos os anéis sozinho. Passe o mouse para ver a fração.
        </p>
      </div>

      <div className="ds-grid ds-grid--2">
        <div className="ds-demo">
          <div className="ds-demo__stage ds-demo__stage--block">
            <div className="ds-col" style={{ gap: 14 }}>
              <span className="ds-label">Formato — sempre com ícone</span>
              <div className="ds-row" style={{ gap: 7 }}>
                {(["Reels", "Carrossel", "Estático", "Stories", "Anúncio"] as const).map((formato) => (
                  <TagFormato key={formato} formato={formato} />
                ))}
              </div>
              <span className="ds-label">Canal — contorno, sem ícone</span>
              <div className="ds-row" style={{ gap: 7 }}>
                <Tag outline>Instagram</Tag>
                <Tag outline>TikTok</Tag>
                <Tag outline>YouTube</Tag>
                <Tag tone="amber" size="lg">Autoridade</Tag>
              </div>
              <span className="ds-label">Contadores e variação</span>
              <div className="ds-row" style={{ gap: 7 }}>
                <Count>22</Count>
                <Count variant="brand">7</Count>
                <Count variant="danger">3</Count>
                <Delta>12%</Delta>
                <Delta direction="down">10%</Delta>
                <Delta direction="flat">0%</Delta>
              </div>
            </div>
          </div>
          <p className="ds-demo__note">
            Formato usa <b>ícone + família de cor</b>; canal usa contorno e nada mais. Duas linguagens para dois eixos
            diferentes — se as duas fossem pílula colorida, nada se distinguiria numa linha de tabela.
          </p>
        </div>

        <div className="ds-demo">
          <div className="ds-demo__stage ds-demo__stage--block">
            <div className="ds-col" style={{ gap: 16 }}>
              <span className="ds-label">Avatar — a foto do membro</span>
              <div className="ds-row">
                {TIME.map((membro, indice) => (
                  <Avatar
                    key={membro.name}
                    name={membro.name}
                    src={membro.src}
                    size={(["xs", "sm", "md", "lg", "xl"] as const)[indice]}
                    presence={indice === 2 ? "on" : undefined}
                  />
                ))}
              </div>
              <span className="ds-label">Sem foto — o fallback</span>
              <div className="ds-row">
                {TIME.map((membro, indice) => (
                  <Avatar key={membro.name} name={membro.name} size={(["xs", "sm", "md", "lg", "xl"] as const)[indice]} />
                ))}
              </div>
              <div className="ds-row">
                <AvatarStack people={TIME} />
                <span className="vz-caption">5 pessoas no plano</span>
              </div>
              <span className="ds-label">Prazo e atraso</span>
              <div className="ds-row" style={{ gap: 16 }}>
                <Due date="22 set" />
                <Due date="05 set" diasParaVencer={1} />
                <Due date="25 set" diasDeAtraso={3} />
              </div>
              <Progress value={7} total={10} label="Conteúdos aprovados" />
              <Progress value={34} label="Captações concluídas" tone="amber" thin />
            </div>
          </div>
          <p className="ds-demo__note">
            <b>O avatar é a foto</b>, não as iniciais. Duas letras estouravam a largura do círculo nos tamanhos
            pequenos e saíam tortas — vira fallback de quem ainda não subiu foto, com a centralização consertada.<br /><br />
            <b>Atraso não é tag.</b>{" "}Tag é pílula com fundo e responde &ldquo;que coisa é essa&rdquo;; atraso é uma
            condição do prazo e mora na coluna de entrega, em texto vermelho com relógio. Antes ele saía como pílula
            vermelha idêntica à etapa &ldquo;Problema&rdquo; e as duas se confundiam na mesma linha.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- 07 · Superfícies ---------- */

export function SecaoSuperficies() {
  return (
    <section className="ds-section" id="superficies">
      <header className="ds-section__head">
        <span className="vz-eyebrow">07 · Componentes</span>
        <h2 className="vz-h1">Cards, avisos e diálogos</h2>
        <p className="vz-body">
          Painel branco sobre fundo lilás-acinzentado, borda quase invisível e sombra rasa. A hierarquia vem da
          elevação, não da espessura da linha.
        </p>
      </header>

      <div className="ds-grid ds-grid--4">
        {[
          { icone: <List size={17} />, cor: "", valor: "22", rotulo: "Conteúdos no plano", delta: "12%", dir: "up" as const },
          { icone: <Loader size={17} />, cor: "amber", valor: "9", rotulo: "Em produção", delta: "4%", dir: "down" as const },
          { icone: <Check size={17} />, cor: "green", valor: "6", rotulo: "Aprovados", delta: "18%", dir: "up" as const },
          { icone: <TriangleAlert size={17} />, cor: "red", valor: "2", rotulo: "Atrasados", delta: "0%", dir: "flat" as const },
        ].map((metrica) => (
          <Card key={metrica.rotulo}>
            <div className="vz-metric">
              <div className="vz-metric__top">
                <span className={`vz-metric__icon${metrica.cor ? ` vz-metric__icon--${metrica.cor}` : ""}`}>{metrica.icone}</span>
                <div>
                  <div className="vz-metric__value">{metrica.valor}</div>
                  <span className="vz-metric__label">{metrica.rotulo}</span>
                </div>
              </div>
              <div className="vz-metric__foot">
                <span>vs. agosto</span>
                <Delta direction={metrica.dir}>{metrica.delta}</Delta>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="ds-grid ds-grid--2">
        <div className="ds-demo">
          <div className="ds-demo__stage ds-demo__stage--grid" style={{ gap: 12 }}>
            <Callout tone="brand" icon={<Sparkles size={15} />}>
              <b>44 pendências</b>{" "}para abrir a aprovação de criativos.
            </Callout>
            <Callout tone="success" icon={<Check size={15} />}>Todos os 22 textos foram aprovados pelo cliente.</Callout>
            <Callout tone="warning" icon={<CircleAlert size={15} />}>Duas captações ainda sem data definida.</Callout>
            <Callout tone="danger" icon={<TriangleAlert size={15} />}>O conteúdo de 07 de set. venceu há 3 dias.</Callout>
          </div>
          <p className="ds-demo__note">Aviso em faixa: fundo suave da família, texto na cor da família, ícone à esquerda.</p>
        </div>

        <div className="ds-demo">
          <div className="ds-demo__stage ds-demo__stage--grid" style={{ gap: 14, justifyItems: "stretch" }}>
            <div className="vz-toast">
              <span className="vz-toast__icon"><Check size={14} /></span>
              <div><b style={{ fontWeight: 620 }}>Plano enviado para aprovação.</b></div>
              <IconButton size="sm" bare aria-label="Fechar" style={{ marginLeft: "auto" }}><Ellipsis size={14} /></IconButton>
            </div>
            <div className="vz-tooltip" style={{ justifySelf: "start" }}>Arraste para mudar a data de entrega</div>
            <Card flat>
              <div className="vz-empty">
                <span className="vz-empty__icon"><ImageIcon size={20} /></span>
                <h3>Nenhum conteúdo neste pacote</h3>
                <p>Adicione o primeiro item ou arraste um conteúdo existente para cá.</p>
                <Button variant="soft" size="sm"><Plus size={14} />Adicionar conteúdo</Button>
              </div>
            </Card>
          </div>
          <p className="ds-demo__note">
            O estado vazio é um componente de primeira classe: ícone, uma frase que explica e a ação que resolve.
          </p>
        </div>
      </div>

      <div className="ds-demo">
        <div className="ds-demo__stage" style={{ justifyContent: "center", padding: 32, background: "var(--vz-bg-sunken)" }}>
          <div className="vz-modal">
            <div className="vz-modal__head">
              <div>
                <span className="vz-eyebrow">Terranet · Setembro 26</span>
                <h3 className="vz-h2" style={{ marginTop: 6 }}>Enviar criativos para aprovação</h3>
              </div>
              <IconButton size="sm" bare aria-label="Fechar"><Ellipsis size={15} /></IconButton>
            </div>
            <div className="vz-modal__body">
              <p className="vz-small" style={{ marginBottom: 16 }}>
                O cliente vai receber 22 conteúdos de uma vez. Depois do envio, a rodada fica travada até ele responder.
              </p>
              <Field label="Recado para o cliente (opcional)">
                <Textarea rows={3} placeholder="Ex.: os dois reels de captação entram na próxima rodada." />
              </Field>
            </div>
            <div className="vz-modal__foot">
              <Button variant="ghost">Cancelar</Button>
              <Button variant="primary"><Send size={14} />Enviar 22 conteúdos</Button>
            </div>
          </div>
        </div>
        <p className="ds-demo__note">
          Modal: raio <code>xl</code>, cabeçalho sem linha, rodapé com fundo rebaixado e a ação principal à direita.
        </p>
      </div>
    </section>
  );
}
