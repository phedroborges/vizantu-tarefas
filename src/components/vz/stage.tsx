"use client";

// A etapa da esteira, com anel de progresso.
//
// O anel responde "quanto falta", que o rótulo sozinho não responde: ninguém
// tem obrigação de saber que "Revisão" vem depois de "Em criação" e antes de
// "Ajuste". A fração sai da POSIÇÃO da etapa na esteira, então mudar a ordem
// da esteira reajusta todos os anéis sozinho.

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import type { Tone } from "./index";

export type EtapaDef = { value: string; label: string; tone: Tone; grupo: string };

// Problema não é ponto da esteira — é alerta. Ele fica de fora da contagem,
// senão a esteira ganharia um degrau que ninguém percorre.
export function progressoDaEtapa(etapas: readonly EtapaDef[], valor: string): number | null {
  const esteira = etapas.filter((etapa) => etapa.value !== "problema");
  const indice = esteira.findIndex((etapa) => etapa.value === valor);
  if (indice < 0) return null;
  return Math.round((indice / (esteira.length - 1)) * 100);
}

export function StageRing({ value, size = 15 }: { value: number; size?: number }) {
  const stroke = 2.4;
  const raio = (size - stroke) / 2;
  const volta = 2 * Math.PI * raio;
  return (
    <svg className="vz-stage__ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle className="vz-stage__track" cx={size / 2} cy={size / 2} r={raio} fill="none" strokeWidth={stroke} />
        <circle
          className="vz-stage__fill"
          cx={size / 2} cy={size / 2} r={raio} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - Math.min(1, Math.max(0, value / 100)))}
        />
      </g>
    </svg>
  );
}

export function Stage({
  etapa,
  etapas,
  size = "md",
}: {
  etapa: string;
  etapas: readonly EtapaDef[];
  size?: "md" | "lg";
}) {
  const def = etapas.find((item) => item.value === etapa);
  if (!def) return null;
  const progresso = progressoDaEtapa(etapas, etapa);
  return (
    <span
      className={`vz-stage vz-stage--${def.tone}${size === "lg" ? " vz-stage--lg" : ""}`}
      title={progresso === null ? def.label : `${def.label} — ${progresso}% da esteira`}
    >
      {progresso === null
        ? <TriangleAlert size={size === "lg" ? 14 : 13} strokeWidth={2.4} style={{ marginLeft: 4 }} />
        : <StageRing value={progresso} size={size === "lg" ? 17 : 15} />}
      {def.label}
    </span>
  );
}

/* ---------- Prazo e atraso ----------
   Atraso NÃO é tag. Tag é pílula com fundo e responde "que coisa é essa"; o
   atraso é uma condição do prazo e mora na coluna de entrega, em texto. Antes
   ele saía como pílula vermelha idêntica à etapa "Problema" e as duas se
   confundiam na mesma linha. */

export function Due({ date, diasDeAtraso, diasParaVencer }: { date: string; diasDeAtraso?: number; diasParaVencer?: number }) {
  if (diasDeAtraso && diasDeAtraso > 0) {
    return (
      <span className="vz-overdue" title={`Venceu há ${diasDeAtraso} ${diasDeAtraso === 1 ? "dia" : "dias"}`}>
        <ClockIcon />
        {date}
        <small>+{diasDeAtraso}d</small>
      </span>
    );
  }
  if (diasParaVencer !== undefined && diasParaVencer <= 2) {
    return <span className="vz-due vz-due--soon" title={`Vence em ${diasParaVencer} ${diasParaVencer === 1 ? "dia" : "dias"}`}><ClockIcon />{date}</span>;
  }
  return <span className="vz-due">{date}</span>;
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
