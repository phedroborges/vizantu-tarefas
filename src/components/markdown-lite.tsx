// Renderiza o "markdown-lite" que a equipe (e a IA) escreve nas descrições:
// títulos ### e **negrito**. É o mesmo texto puro que fica em tasks.description
// — nada de HTML injetado, os pedaços viram nós de texto e <strong>.
//
// Usado nos dois lados: no modal da tarefa (visão interna) e no painel do
// cliente. Quebras de linha ficam por conta do `white-space: pre-wrap` de quem
// renderiza, então o texto original é preservado caractere a caractere.

import type { ReactNode } from "react";

// Um ** ... ** que não atravessa quebra de linha — assim um asterisco solto no
// meio do roteiro não "come" o resto do parágrafo procurando o par.
const BOLD = /\*\*([^*\n]+)\*\*/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  BOLD.lastIndex = 0;
  while ((match = BOLD.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(<strong key={`${keyPrefix}-${match.index}`}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderMarkdownLite(text: string): ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, index) => {
    const heading = /^\s*###\s+(.+?)\s*$/.exec(line);
    const content = heading ? heading[1] : line;
    const rendered = renderInline(content, String(index));
    if (heading) return <h3 className="markdown-lite-h3" key={index}>{rendered}</h3>;
    return <span className="markdown-lite-line" key={index}>{rendered}{index < lines.length - 1 ? "\n" : null}</span>;
  });
}
