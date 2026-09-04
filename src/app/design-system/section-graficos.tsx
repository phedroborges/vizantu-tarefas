"use client";

import * as React from "react";
import { ChevronDown, TrendingUp } from "lucide-react";
import { Avatar, Button, Card, Tag } from "@/components/vz";
import { TIME } from "./data";

/* ---------- 11 · Gráficos ---------- */

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PRODUZIDOS = [34, 41, 38, 47, 44, 52, 49, 58, 55, 62, 59, 68];
const APROVADOS = [22, 28, 26, 33, 31, 38, 36, 43, 41, 47, 45, 54];

// Carga por pessoa, quebrada pelo grupo da esteira. Grupo de etapa é ESTADO,
// então usa a paleta de estado (azul esperando / âmbar produzindo / verde
// feito) e vem sempre com rótulo escrito — cor sozinha nunca carrega o sentido.
const CARGA = [
  { pessoa: "Cynthia Almeida", esperando: 5, produzindo: 6, feito: 9 },
  { pessoa: "Erika Iorrana", esperando: 3, produzindo: 8, feito: 4 },
  { pessoa: "Luis Fontes", esperando: 1, produzindo: 4, feito: 11 },
  { pessoa: "Marina Reis", esperando: 6, produzindo: 2, feito: 3 },
  { pessoa: "Phedro Borges", esperando: 2, produzindo: 1, feito: 7 },
];

const GRUPOS = [
  { key: "esperando" as const, label: "Aguardando terceiros", cor: "var(--vz-chart-4)" },
  { key: "produzindo" as const, label: "Em produção", cor: "var(--vz-chart-3)" },
  { key: "feito" as const, label: "Entregue", cor: "var(--vz-chart-2)" },
];

export function SecaoGraficos() {
  return (
    <section className="ds-section" id="graficos">
      <header className="ds-section__head">
        <span className="vz-eyebrow">11 · Dados</span>
        <h2 className="vz-h1">Gráficos</h2>
        <p className="vz-body">
          A rampa dos gráficos não é a mesma lista das tags — e isso é de propósito. Tag é fundo suave com texto
          escuro em cima, e o texto carrega o contraste; a marca do gráfico é cor sólida sozinha sobre o papel, e
          precisa se sustentar sem texto nenhum. Os cinco passos abaixo passaram no validador de paleta: faixa de
          luminosidade, piso de croma, separação sob daltonismo <b>em todos os pares</b>, piso de visão normal e
          contraste contra o papel. O escuro tem passos próprios, não é o claro clareado.
        </p>
      </header>

      <div className="ds-demo">
        <div className="ds-demo__stage ds-demo__stage--block">
          <div className="ds-row" style={{ gap: 20 }}>
            {["1 violeta", "2 verde", "3 âmbar", "4 azul", "5 rosa"].map((nome, indice) => (
              <span key={nome} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--vz-text-muted)" }}>
                <i style={{ width: 22, height: 22, borderRadius: 6, background: `var(--vz-chart-${indice + 1})` }} />
                {nome}
              </span>
            ))}
          </div>
        </div>
        <p className="ds-demo__note">
          <b>São cinco, não seis.</b>{" "}O turquesa não sobrevive ao lado do verde e do rosa para quem tem deuteranopia
          (ΔE 1.6 — indistinguível). Ele continua sendo família de tag, onde o rótulo escrito resolve, mas não é vaga
          de gráfico. Uma sexta série vira &ldquo;Outros&rdquo;, facetas ou uma tabela — nunca uma cor gerada na hora.
        </p>
      </div>

      <Card>
        <div className="vz-card__head">
          <div className="vz-card__title">
            <h3 className="vz-h3">Entregas por mês</h3>
            <span className="vz-caption">Conteúdos produzidos e aprovados ao longo de 2026</span>
          </div>
          <Button variant="secondary" size="sm">Este ano<ChevronDown size={13} /></Button>
        </div>
        <div className="vz-card__body">
          <div className="vz-stat-row" style={{ marginBottom: 22 }}>
            <div className="vz-stat">
              <span className="vz-stat__value">607</span>
              <span className="vz-stat__label">Produzidos no ano</span>
              <span className="vz-stat__foot"><TrendingUp size={12} color="var(--vz-green-ink)" />+18% vs. 2025</span>
            </div>
            <div className="vz-stat">
              <span className="vz-stat__value">440</span>
              <span className="vz-stat__label">Aprovados no ano</span>
              <span className="vz-stat__foot">72% do que foi produzido</span>
            </div>
            <div className="vz-stat">
              <span className="vz-stat__value">68</span>
              <span className="vz-stat__label">Produzidos em dezembro</span>
              <span className="vz-stat__foot">melhor mês do ano</span>
            </div>
          </div>
          <GraficoLinha />
        </div>
      </Card>
      <p className="ds-demo__note" style={{ padding: 0 }}>
        Passe o mouse sobre o gráfico. Um eixo só (nunca dois), grade em fio sólido — tracejado lê como
        &ldquo;projeção&rdquo; quando é só grade —, legenda sempre presente e rótulo direto <b>só na ponta</b>,
        não em cima de cada ponto.
      </p>

      <Card>
        <div className="vz-card__head">
          <div className="vz-card__title">
            <h3 className="vz-h3">Carga por pessoa</h3>
            <span className="vz-caption">Onde está cada tarefa aberta do time, por etapa da esteira</span>
          </div>
          <Tag outline>Setembro</Tag>
        </div>
        <div className="vz-card__body">
          <GraficoCarga />
        </div>
      </Card>
      <div className="ds-demo">
        <p className="ds-demo__note" style={{ padding: "14px 16px" }}>
          <b>O que substituiu a rosca.</b>{" "}A rosca de &ldquo;68% do plano&rdquo; contava uma história de um número só —
          e um número só se lê melhor como número grande do que como fatia (é o que os três valores acima do gráfico de
          linha fazem agora). A pergunta que faltava responder era outra, e nenhuma tela do produto respondia:{" "}
          <b>quem está sobrecarregado, e travado em quê</b>. Barra empilhada por pessoa responde isso de relance — a
          Erika tem 8 tarefas em produção contra 4 do Luis, e a Marina está com 6 paradas esperando terceiros.
        </p>
      </div>
    </section>
  );
}

// Área + linha em SVG. Cruz de leitura e dica seguem o ponteiro: um gráfico em
// HTML já é interativo, então não entregar hover é desperdiçar o meio.
function GraficoLinha() {
  const [ativo, setAtivo] = React.useState<number | null>(null);
  const largura = 720;
  const altura = 210;
  const teto = 80;
  const passo = largura / (PRODUZIDOS.length - 1);
  const y = (valor: number) => altura - (valor / teto) * altura;
  const caminho = (serie: number[]) => `M ${serie.map((valor, indice) => `${indice * passo},${y(valor)}`).join(" L ")}`;

  return (
    <div className="vz-chart">
      <div className="vz-chart__plot" style={{ position: "relative" }}>
        <svg
          viewBox={`0 -10 ${largura + 46} ${altura + 34}`}
          width="100%" height={252} role="img"
          aria-label="Conteúdos produzidos e aprovados por mês em 2026"
          onMouseLeave={() => setAtivo(null)}
        >
          <defs>
            <linearGradient id="vz-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--vz-chart-1)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--vz-chart-1)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g className="vz-chart__grid">
            {[0, 0.25, 0.5, 0.75, 1].map((fracao) => (
              <line key={fracao} x1="0" x2={largura} y1={altura * fracao} y2={altura * fracao} />
            ))}
          </g>
          <g className="vz-chart__axis">
            {[80, 60, 40, 20, 0].map((valor, indice) => (
              <text key={valor} x={largura + 8} y={altura * (indice / 4) + 3.5}>{valor}</text>
            ))}
          </g>

          <path d={`${caminho(PRODUZIDOS)} L ${largura},${altura} L 0,${altura} Z`} fill="url(#vz-area)" />
          <path d={caminho(PRODUZIDOS)} fill="none" stroke="var(--vz-chart-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={caminho(APROVADOS)} fill="none" stroke="var(--vz-chart-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Rótulo direto só na ponta — número em cima de cada ponto é ruído. */}
          <text className="vz-chart__endlabel" x={(PRODUZIDOS.length - 1) * passo - 4} y={y(PRODUZIDOS[11]) - 9} fill="var(--vz-chart-1)" textAnchor="end">Produzidos 68</text>
          <text className="vz-chart__endlabel" x={(APROVADOS.length - 1) * passo - 4} y={y(APROVADOS[11]) + 16} fill="var(--vz-chart-2)" textAnchor="end">Aprovados 54</text>

          {ativo !== null && (
            <g>
              <line className="vz-chart__crosshair" x1={ativo * passo} x2={ativo * passo} y1="0" y2={altura} />
              <circle className="vz-chart__dot" cx={ativo * passo} cy={y(PRODUZIDOS[ativo])} r="4.5" fill="var(--vz-chart-1)" />
              <circle className="vz-chart__dot" cx={ativo * passo} cy={y(APROVADOS[ativo])} r="4.5" fill="var(--vz-chart-2)" />
            </g>
          )}

          {/* Alvo de mouse por mês, bem maior que a marca. */}
          {MESES.map((mes, indice) => (
            <rect
              key={mes} className="vz-chart__hit"
              x={indice * passo - passo / 2} y={-10} width={passo} height={altura + 34}
              onMouseEnter={() => setAtivo(indice)}
            />
          ))}

          <g className="vz-chart__axis">
            {MESES.map((mes, indice) => (
              <text key={mes} x={indice * passo} y={altura + 20} textAnchor="middle" opacity={ativo === indice ? 1 : 0.75} fontWeight={ativo === indice ? 700 : 400}>
                {mes}
              </text>
            ))}
          </g>
        </svg>

        {ativo !== null && (
          <div
            className="vz-chart__tip"
            style={{
              left: `${Math.min(84, (ativo / (MESES.length - 1)) * 100)}%`,
              top: 4,
              transform: ativo > 8 ? "translateX(-100%)" : undefined,
            }}
          >
            <b>{MESES[ativo]} de 2026</b>
            <div><span><i className="vz-chart__swatch" style={{ background: "var(--vz-chart-1)", display: "inline-block", marginRight: 6 }} />Produzidos</span><b>{PRODUZIDOS[ativo]}</b></div>
            <div><span><i className="vz-chart__swatch" style={{ background: "var(--vz-chart-2)", display: "inline-block", marginRight: 6 }} />Aprovados</span><b>{APROVADOS[ativo]}</b></div>
          </div>
        )}
      </div>

      <div className="vz-chart__legend">
        <span><i className="vz-chart__swatch" style={{ background: "var(--vz-chart-1)" }} />Produzidos</span>
        <span><i className="vz-chart__swatch" style={{ background: "var(--vz-chart-2)" }} />Aprovados</span>
      </div>
    </div>
  );
}

function GraficoCarga() {
  const maior = Math.max(...CARGA.map((linha) => linha.esperando + linha.produzindo + linha.feito));
  return (
    <div className="vz-chart">
      <div className="vz-stack">
        {CARGA.map((linha) => {
          const total = linha.esperando + linha.produzindo + linha.feito;
          const dono = TIME.find((membro) => membro.name === linha.pessoa)!;
          return (
            <div className="vz-stack__row" key={linha.pessoa}>
              <span className="vz-stack__who">
                <Avatar name={dono.name} src={dono.src} size="xs" />
                <span>{dono.name.split(" ")[0]}</span>
              </span>
              <div className="vz-stack__bar" style={{ width: `${(total / maior) * 100}%` }}>
                {GRUPOS.map((grupo) => {
                  const valor = linha[grupo.key];
                  if (!valor) return null;
                  return (
                    <div
                      key={grupo.key}
                      className="vz-stack__seg"
                      style={{ flex: valor, background: grupo.cor }}
                      title={`${dono.name} — ${valor} ${valor === 1 ? "tarefa" : "tarefas"} · ${grupo.label}`}
                    >
                      {/* Rótulo dentro do segmento só quando cabe. */}
                      {valor >= 3 ? valor : ""}
                    </div>
                  );
                })}
              </div>
              <b className="vz-stack__total">{total}</b>
            </div>
          );
        })}
      </div>
      <div className="vz-chart__legend">
        {GRUPOS.map((grupo) => (
          <span key={grupo.key}><i className="vz-chart__swatch" style={{ background: grupo.cor }} />{grupo.label}</span>
        ))}
      </div>
    </div>
  );
}
