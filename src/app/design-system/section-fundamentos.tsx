"use client";

import { Tag } from "@/components/vz";
import { Logo } from "@/components/vz/logo";

const MARCA = [
  { nome: "Brand", token: "--vz-brand", hex: "#9147ff" },
  { nome: "Brand strong", token: "--vz-brand-strong", hex: "#6435e7" },
  { nome: "Brand deep", token: "--vz-brand-deep", hex: "#4b23b8" },
  { nome: "Brand soft", token: "--vz-brand-soft", hex: "#f3ecff" },
];

const SUPERFICIE = [
  { nome: "Fundo", token: "--vz-bg", hex: "#f6f6fa" },
  { nome: "Fundo rebaixado", token: "--vz-bg-sunken", hex: "#eff0f5" },
  { nome: "Painel", token: "--vz-panel", hex: "#ffffff" },
  { nome: "Traço", token: "--vz-line", hex: "#ebecf2" },
  { nome: "Traço forte", token: "--vz-line-strong", hex: "#dedfe8" },
  { nome: "Texto", token: "--vz-text", hex: "#14151c" },
  { nome: "Texto apoio", token: "--vz-text-muted", hex: "#6d7183" },
  { nome: "Texto fraco", token: "--vz-text-faint", hex: "#9599a8" },
];

const FAMILIAS = [
  { nome: "Violeta", slug: "violet", uso: "marca, seleção, reels" },
  { nome: "Verde", slug: "green", uso: "aprovado, no prazo, sucesso" },
  { nome: "Âmbar", slug: "amber", uso: "em produção, atenção" },
  { nome: "Vermelho", slug: "red", uso: "problema, atraso, apagar" },
  { nome: "Azul", slug: "blue", uso: "aguardando terceiros, informação" },
  { nome: "Rosa", slug: "pink", uso: "stories, categoria extra" },
  { nome: "Turquesa", slug: "teal", uso: "categoria extra" },
  { nome: "Cinza", slug: "slate", uso: "neutro, rascunho, desligado" },
] as const;

const TIPOS = [
  { classe: "vz-display", token: "34px / 680", texto: "Terranet | Setembro 26" },
  { classe: "vz-h1", token: "26px / 660", texto: "Plano de conteúdo" },
  { classe: "vz-h2", token: "20px / 640", texto: "Pacotes de produção" },
  { classe: "vz-h3", token: "16px / 620", texto: "Calendário do mês" },
  { classe: "vz-body", token: "14px / 400", texto: "Conteúdos agrupados por formato. A captação é escolhida por item." },
  { classe: "vz-small", token: "13px / 400", texto: "Arraste um conteúdo para mudar a data de entrega." },
  { classe: "vz-caption", token: "12px / 400", texto: "Cynthia Almeida · 09 de set." },
  { classe: "vz-eyebrow", token: "11px / 700 · caixa alta", texto: "Fluxo do cliente" },
];

const RAIOS = ["xs", "sm", "md", "lg", "xl"] as const;
const SOMBRAS = ["xs", "sm", "md", "lg"] as const;
const ESPACOS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const;

function Swatch({ nome, token, hex }: { nome: string; token: string; hex: string }) {
  return (
    <div className="ds-swatch">
      <div className="ds-swatch__chip" style={{ background: `var(${token})` }} />
      <div className="ds-swatch__info">
        <b>{nome}</b>
        <code>{token}</code>
        <code>{hex}</code>
      </div>
    </div>
  );
}

export function SecaoCor() {
  return (
    <section className="ds-section" id="cor">
      <header className="ds-section__head">
        <span className="vz-eyebrow">01 · Fundamentos</span>
        <h2 className="vz-h1">Cor</h2>
        <p className="vz-body">
          O roxo da Vizantu é o único acento forte da interface — ele marca o que está ativo e a ação principal, e nada
          mais. Todo o resto do produto vive em superfícies neutras. As oito famílias semânticas existem para dizer{" "}
          <b> em que estado</b>{" "}uma coisa está, e cada uma tem três papéis: fundo, traço e texto.
        </p>
      </header>

      <div className="ds-col">
        <span className="ds-label">A logo</span>
        <div className="ds-logo-demo">
          <div className="ds-logo-demo__claro">
            <Logo height={30} />
            <Logo variant="simbolo" height={30} />
            <Logo variant="simbolo" height={18} />
          </div>
          <div className="ds-logo-demo__escuro">
            <Logo height={30} />
            <Logo variant="simbolo" height={30} />
            <Logo variant="simbolo" height={18} />
          </div>
        </div>
        <p className="vz-caption">
          É a mesma peça nas duas faixas, sem trocar de arquivo: o <b>símbolo</b> mantém o roxo da marca — ele é a
          identidade e não muda com o tema — e a <b>palavra</b> sai em <code>currentColor</code>, herdando a cor do
          texto de onde estiver. O símbolo sozinho serve para barra recolhida, favicon e avatar de projeto.
        </p>
      </div>

      <div className="ds-col">
        <span className="ds-label">Marca</span>
        <div className="ds-grid ds-grid--4">{MARCA.map((cor) => <Swatch key={cor.token} {...cor} />)}</div>
      </div>

      <div className="ds-col">
        <span className="ds-label">Superfície e texto</span>
        <div className="ds-grid ds-grid--4">{SUPERFICIE.map((cor) => <Swatch key={cor.token} {...cor} />)}</div>
      </div>

      <div className="ds-col">
        <span className="ds-label">Famílias semânticas</span>
        <div className="ds-demo">
          <div className="ds-demo__stage ds-demo__stage--block">
            <div className="ds-grid ds-grid--2">
              {FAMILIAS.map((familia) => (
                <div key={familia.slug} style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 30, height: 30, borderRadius: "var(--vz-r-sm)", background: `var(--vz-${familia.slug}-solid)` }} />
                    <span style={{ width: 30, height: 30, borderRadius: "var(--vz-r-sm)", background: `var(--vz-${familia.slug}-bg)`, border: `1px solid var(--vz-${familia.slug}-line)` }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 620 }}>{familia.nome}</div>
                      <div className="vz-caption" style={{ fontSize: 11 }}>{familia.uso}</div>
                    </div>
                  </div>
                  <div className="ds-row" style={{ gap: 6 }}>
                    <Tag tone={familia.slug}>Suave</Tag>
                    <Tag tone={familia.slug} solid={familia.slug !== "pink" && familia.slug !== "teal"}>Sólida</Tag>
                    <Tag tone={familia.slug} outline>Contorno</Tag>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="ds-demo__note">
            <b>Regra:</b>{" "}tag é <code>fundo suave + texto na cor</code>. A versão sólida fica reservada para a etapa
            atual do status quando ela é a manchete da tela. Hoje o app pinta <i>todas</i>{" "}as tags de sólido, e por isso
            a lista de conteúdos vira um vitral — o olho não consegue eleger o que importa.
          </p>
        </div>
      </div>
    </section>
  );
}

export function SecaoTipografia() {
  return (
    <section className="ds-section" id="tipografia">
      <header className="ds-section__head">
        <span className="vz-eyebrow">02 · Fundamentos</span>
        <h2 className="vz-h1">Tipografia</h2>
        <p className="vz-body">
          Geist em toda a interface, Geist Mono para número técnico e token. São quatro papéis — manchete de tela,
          título de bloco, corpo e apoio — e não uma escala aberta de dez tamanhos: cada texto novo tem que caber em um
          deles.
        </p>
      </header>
      <div className="ds-demo">
        <div className="ds-demo__stage ds-demo__stage--block">
          {TIPOS.map((tipo) => (
            <div className="ds-typerow" key={tipo.classe}>
              <div><code>{tipo.classe.replace("vz-", "")}</code><div className="vz-caption" style={{ fontSize: 10 }}>{tipo.token}</div></div>
              <div className={tipo.classe}>{tipo.texto}</div>
            </div>
          ))}
        </div>
        <p className="ds-demo__note">
          Números de tabela e métrica saem sempre com <code>font-variant-numeric: tabular-nums</code>{" "}(classe{" "}
          <code>vz-numeric</code>) — sem isso as colunas de prazo e contagem dançam a cada re-render.
        </p>
      </div>
    </section>
  );
}

export function SecaoForma() {
  return (
    <section className="ds-section" id="forma">
      <header className="ds-section__head">
        <span className="vz-eyebrow">03 · Fundamentos</span>
        <h2 className="vz-h1">Raio, elevação e espaço</h2>
        <p className="vz-body">
          A mudança mais visível em relação ao sistema atual: hoje tudo é canto reto (<code>--radius: 0</code>) com borda
          dura. O sistema novo arredonda e troca borda por sombra rasa — é o que separa camadas sem riscar a tela de
          linhas.
        </p>
      </header>

      <div className="ds-demo">
        <div className="ds-demo__stage ds-demo__stage--block">
          <div className="ds-col" style={{ gap: 28 }}>
            <div className="ds-col">
              <span className="ds-label">Raio</span>
              <div className="ds-ramp">
                {RAIOS.map((raio) => (
                  <div className="ds-ramp__item" key={raio}>
                    <div className="ds-ramp__box" style={{ borderRadius: `var(--vz-r-${raio})` }} />
                    <code>r-{raio}</code>
                  </div>
                ))}
                <div className="ds-ramp__item">
                  <div className="ds-ramp__box" style={{ borderRadius: "var(--vz-r-pill)" }} />
                  <code>r-pill</code>
                </div>
              </div>
            </div>

            <div className="ds-col">
              <span className="ds-label">Elevação</span>
              <div className="ds-ramp">
                {SOMBRAS.map((sombra) => (
                  <div className="ds-ramp__item" key={sombra}>
                    <div className="ds-ramp__box ds-ramp__box--shadow" style={{ boxShadow: `var(--vz-shadow-${sombra})`, borderRadius: "var(--vz-r-md)" }} />
                    <code>shadow-{sombra}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="ds-col">
              <span className="ds-label">Espaço — régua de 4</span>
              <div className="ds-ramp" style={{ alignItems: "flex-end" }}>
                {ESPACOS.map((espaco) => (
                  <div className="ds-ramp__item" key={espaco}>
                    <div style={{ width: 26, height: `var(--vz-s-${espaco})`, borderRadius: 3, background: "var(--vz-brand-line)" }} />
                    <code>s-{espaco}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="ds-demo__note">
          <b>Onde usar cada raio:</b> <code>xs</code>{" "}em item de menu e pastilha de calendário, <code>sm</code>{" "}em botão
          e campo, <code>md</code>{" "}em card de board e popover, <code>lg</code>{" "}em painel e tabela, <code>xl</code>{" "}em
          modal, <code>pill</code>{" "}em tag, avatar e contador.
        </p>
      </div>
    </section>
  );
}
