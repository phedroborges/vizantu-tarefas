// O carregamento do sistema: o símbolo da Vizantu se montando.
//
// As quatro peças do símbolo acendem em sequência, no sentido horário, e o
// círculo do centro pulsa junto. É a marca dizendo "estou trabalhando", no
// lugar de um texto solto ou de um spinner genérico.
//
// Sem hooks de estado e sem "use client": serve tanto no loading.tsx das rotas
// (servidor) quanto dentro de qualquer componente. Tudo é <span>, então cabe
// até dentro de um parágrafo ou da descrição de um diálogo.
//
// Os caminhos são os mesmos do símbolo em logo.tsx.

import * as React from "react";

const TAMANHO = { page: 60, block: 38, inline: 16 } as const;

export function VzLoading({
  label = "Carregando…",
  size = "block",
  className,
}: {
  /** O que está sendo carregado. Aparece abaixo (ou ao lado) do símbolo. */
  label?: string;
  /** page: tela inteira. block: um painel ou diálogo. inline: ao lado de um texto. */
  size?: keyof typeof TAMANHO;
  className?: string;
}) {
  const gradiente = `vz-loading-${React.useId().replace(/:/g, "")}`;
  const altura = TAMANHO[size];
  return (
    <span className={`vz-loading vz-loading--${size}${className ? ` ${className}` : ""}`} role="status" aria-live="polite">
      <svg className="vz-loading__mark" viewBox="0 0 369.44 295.55" height={altura} width={(altura * 369.44) / 295.55} aria-hidden="true">
        <defs>
          <linearGradient id={gradiente} x1="133.53" y1="147.78" x2="235.91" y2="147.78" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#6435e7" />
            <stop offset=".52" stopColor="#7b3ef3" />
            <stop offset="1" stopColor="#9147ff" />
          </linearGradient>
        </defs>
        {/* Na ordem em que acendem: cima-esquerda, cima-direita, baixo-direita, baixo-esquerda. */}
        <path className="vz-loading__piece" fill="#6435e7" d="M12.25,67.76L147.78,0v73.89S0,147.78,0,147.78v-60.19c0-8.4,4.74-16.07,12.25-19.82Z" />
        <path className="vz-loading__piece" fill="#6435e7" d="M357.19,67.76L221.67,0v73.89l147.78,73.89v-60.19c0-8.4-4.74-16.07-12.25-19.82Z" />
        <path className="vz-loading__piece" fill="#9147ff" d="M357.19,227.79l-135.53,67.76v-73.89s147.78-73.89,147.78-73.89v60.19c0,8.4-4.74,16.07-12.25,19.82Z" />
        <path className="vz-loading__piece" fill="#9147ff" d="M12.25,227.79l135.53,67.76v-73.89L0,147.78v60.19C0,216.36,4.74,224.04,12.25,227.79Z" />
        <circle className="vz-loading__core" fill={`url(#${gradiente})`} cx="184.72" cy="147.78" r="51.19" />
      </svg>
      <span className="vz-loading__label">{label}</span>
    </span>
  );
}
