"use client";

// Seletor com ícone por opção.
//
// O <select> nativo não aceita ícone dentro da <option>, e num sistema em que
// pacote é "vídeo", "carrossel" ou "estático" o ícone é justamente o que se lê
// antes do texto. Por isso este é um listbox próprio — com o teclado
// funcionando como o nativo (setas, Home/End, Enter, Esc).

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Tone } from "./index";

export type PickerOption = {
  value: string;
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  group?: string;
};

export function Picker({
  options,
  value,
  onChange,
  placeholder = "Selecione…",
  id,
}: {
  options: PickerOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [ativo, setAtivo] = React.useState(0);
  const raiz = React.useRef<HTMLDivElement>(null);
  const lista = React.useRef<HTMLDivElement>(null);
  const selecionada = options.find((option) => option.value === value) ?? null;

  // Fechar ao clicar fora. Sem isso o listbox fica aberto atrás de qualquer
  // outra coisa que o usuário clicar na tela.
  React.useEffect(() => {
    if (!aberto) return;
    const fora = (evento: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  React.useEffect(() => {
    if (!aberto || !lista.current) return;
    lista.current.querySelector<HTMLElement>(`[data-index="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [aberto, ativo]);

  // Abrir posiciona o cursor na opção já escolhida — é a única coisa que
  // "abrir" precisa fazer além de mostrar a lista.
  function abrir() {
    const indice = options.findIndex((option) => option.value === value);
    setAtivo(indice < 0 ? 0 : indice);
    setAberto(true);
  }

  function teclado(evento: React.KeyboardEvent) {
    if (!aberto && (evento.key === "ArrowDown" || evento.key === "Enter" || evento.key === " ")) {
      evento.preventDefault();
      abrir();
      return;
    }
    if (!aberto) return;
    if (evento.key === "Escape") { evento.preventDefault(); setAberto(false); }
    if (evento.key === "ArrowDown") { evento.preventDefault(); setAtivo((atual) => Math.min(options.length - 1, atual + 1)); }
    if (evento.key === "ArrowUp") { evento.preventDefault(); setAtivo((atual) => Math.max(0, atual - 1)); }
    if (evento.key === "Home") { evento.preventDefault(); setAtivo(0); }
    if (evento.key === "End") { evento.preventDefault(); setAtivo(options.length - 1); }
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      const escolhida = options[ativo];
      if (escolhida) { onChange(escolhida.value); setAberto(false); }
    }
  }

  return (
    <div className="vz-picker" ref={raiz}>
      <button
        type="button"
        id={id}
        className="vz-picker__button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={teclado}
      >
        <span className="vz-picker__value">
          {selecionada?.icon && <Glyph tone={selecionada.tone}>{selecionada.icon}</Glyph>}
          <span style={selecionada ? undefined : { color: "var(--vz-text-faint)" }}>{selecionada?.label ?? placeholder}</span>
        </span>
        <ChevronDown size={15} />
      </button>

      {aberto && (
        <div className="vz-picker__list" role="listbox" ref={lista}>
          {options.map((option, indice) => {
            // O cabeçalho sai da comparação com o item ANTERIOR da lista, e não
            // de uma variável que se reatribui durante o render: em modo estrito
            // o React roda o render duas vezes e a variável chegaria suja.
            const cabecalho = option.group && option.group !== options[indice - 1]?.group ? option.group : null;
            return (
              <React.Fragment key={option.value}>
                {cabecalho && <div className="vz-picker__group">{cabecalho}</div>}
                <button
                  type="button"
                  role="option"
                  data-index={indice}
                  data-active={indice === ativo}
                  aria-selected={option.value === value}
                  className="vz-picker__option"
                  onMouseEnter={() => setAtivo(indice)}
                  onClick={() => { onChange(option.value); setAberto(false); }}
                >
                  {option.icon && <Glyph tone={option.tone}>{option.icon}</Glyph>}
                  <span style={{ minWidth: 0 }}>
                    {option.label}
                    {option.sub && <span className="vz-picker__sub">{option.sub}</span>}
                  </span>
                  {option.value === value && <Check size={15} />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Glyph({ tone, children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`vz-picker__glyph${tone ? ` vz-picker__glyph--${tone}` : ""}`}>{children}</span>;
}
