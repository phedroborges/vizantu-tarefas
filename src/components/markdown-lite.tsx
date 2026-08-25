// Renderiza o "markdown-lite" que a equipe (e a IA) escreve nas descrições:
// títulos ###, **negrito** e links. É o mesmo texto puro que fica em
// tasks.description — nada de HTML injetado, os pedaços viram nós de texto,
// <strong> e <a>.
//
// Usado nos dois lados: no modal da tarefa (visão interna) e no painel do
// cliente. Quebras de linha ficam por conta do `white-space: pre-wrap` de quem
// renderiza, então o texto original é preservado caractere a caractere.

import type { MouseEvent, ReactNode } from "react";

// Três formas inline, numa varredura só. A ordem da alternância importa: o link
// markdown precisa vir antes da URL solta, senão o https de dentro dos
// parênteses viraria link sozinho e o [texto] ficaria órfão na tela.
//
// O ** ... ** não atravessa quebra de linha — assim um asterisco solto no meio
// do roteiro não "come" o resto do parágrafo procurando o par.
//
// Só http/https entram no href. É isso que mantém a promessa do arquivo: um
// `javascript:` escrito na descrição continua sendo texto, nunca um link.
const INLINE =
  /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()[\]]+)/g;

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="markdown-lite-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // O RichTextField embrulha a prévia num onClick que entra em edição.
      // Sem isto, abrir uma referência também jogaria o campo em modo de
      // edição por baixo. Clicar fora do link continua editando normalmente.
      onClick={(event: MouseEvent) => event.stopPropagation()}
    >
      {children}
    </a>
  );
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${match.index}`;
    const [bold, linkText, linkHref, bareUrl] = [match[1], match[2], match[3], match[4]];

    if (bold !== undefined) {
      nodes.push(<strong key={key}>{bold}</strong>);
      last = match.index + match[0].length;
    } else if (linkHref !== undefined) {
      nodes.push(<ExternalLink key={key} href={linkHref}>{linkText}</ExternalLink>);
      last = match.index + match[0].length;
    } else {
      // URL solta: a pontuação que fecha a frase ("a referência é https://x.com.")
      // não faz parte do endereço, então sai do link e volta a ser texto.
      const href = bareUrl.replace(/[.,;:!?]+$/, "");
      nodes.push(<ExternalLink key={key} href={href}>{href}</ExternalLink>);
      last = match.index + href.length;
    }
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
