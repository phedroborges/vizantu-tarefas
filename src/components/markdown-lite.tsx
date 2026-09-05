// Renderiza o "markdown-lite" que a equipe (e a IA) escreve nas descrições:
// títulos ###, **negrito** e links. É o mesmo texto puro que fica em
// tasks.description — nada de HTML injetado, os pedaços viram nós de texto,
// <strong> e <a>.
//
// Usado nos dois lados: no modal da tarefa (visão interna) e no painel do
// cliente. Quebras de linha ficam por conta do `white-space: pre-wrap` de quem
// renderiza, então o texto original é preservado caractere a caractere.

import { AtSign, ExternalLink as ExternalLinkIcon, FileText, Globe2, Play } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

// Quatro formas inline, numa varredura só. A ordem da alternância importa em
// dois pontos: a imagem ![alt](url) vem antes do link, senão o [alt](url) de
// dentro casaria como link e o "!" ficaria solto na tela; e o link markdown vem
// antes da URL solta, senão o https de dentro dos parênteses viraria link
// sozinho e o [texto] ficaria órfão.
//
// O ** ... ** não atravessa quebra de linha — assim um asterisco solto no meio
// do roteiro não "come" o resto do parágrafo procurando o par.
//
// Só http/https entram no href e no src. É isso que mantém a promessa do
// arquivo: um `javascript:` escrito na descrição continua sendo texto, nunca um
// link — e um `data:` não vira imagem.
const INLINE =
  /!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()[\]]+)/g;

function siteMeta(href: string) {
  const host = new URL(href).hostname.replace(/^www\./, "");
  if (host.includes("drive.google") || host.includes("docs.google")) return { host, label: "Google", icon: <FileText size={13} /> };
  if (host.includes("instagram")) return { host, label: "Instagram", icon: <AtSign size={13} /> };
  if (host.includes("youtube") || host === "youtu.be") return { host, label: "YouTube", icon: <Play size={13} /> };
  return { host, label: host, icon: <Globe2 size={13} /> };
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const site = siteMeta(href);
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
      <span className="markdown-lite-link__icon">{site.icon}</span>
      <span className="markdown-lite-link__copy"><strong>{children}</strong><small>{site.host}</small></span>
      <ExternalLinkIcon className="markdown-lite-link__external" size={12} />
    </a>
  );
}

// A imagem abre em tamanho cheio numa aba nova. O stopPropagation é pelo mesmo
// motivo do link: o RichTextField entra em edição ao clicar na prévia, e clicar
// numa referência pra ampliar não é pedido pra editar.
function InlineImage({ src, alt }: { src: string; alt: string }) {
  return (
    <a
      className="markdown-lite-image"
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event: MouseEvent) => event.stopPropagation()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" />
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
    const [imageAlt, imageSrc, bold, linkText, linkHref, bareUrl] = [match[1], match[2], match[3], match[4], match[5], match[6]];

    if (imageSrc !== undefined) {
      nodes.push(<InlineImage key={key} src={imageSrc} alt={imageAlt || ""} />);
      last = match.index + match[0].length;
    } else if (bold !== undefined) {
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
