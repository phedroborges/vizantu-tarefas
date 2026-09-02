"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { renderContract, type ContractFields } from "@/lib/contract-render";
import type { PaymentStructure } from "@/lib/contract-templates";

// O contrato na tela, no mesmo formato em que ele sai impresso. Não existe uma
// "prévia" diferente do documento final: o que aparece aqui é exatamente o que
// o PDF leva, porque o PDF é a impressão desta mesma marcação.
//
// A marcação do corpo é curta de propósito, pra caber na cabeça de quem for
// editar uma cláusula: "# título", "## cláusula", "- item", **negrito**, e um
// bloco :::assinaturas para o fecho. Nada além disso.

// Campo que ninguém preencheu chega marcado com «guilhemets» (ver
// contract-render). Aqui ele fica visualmente óbvio: é a última defesa contra
// mandar pro cliente um contrato com o valor em branco.
const INLINE = /\*\*([^*]+)\*\*|«([^»]+)»/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${match.index}`;
    if (match[1] !== undefined) nodes.push(<strong key={key}>{match[1]}</strong>);
    else nodes.push(<mark className="contract-pending" key={key}>{match[2]}</mark>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { kind: "titulo" | "clausula" | "paragrafo"; text: string }
  | { kind: "lista"; items: string[] }
  | { kind: "assinaturas"; text: string };

// Uma varredura só, linha a linha. Bullets seguidos viram uma lista; linhas
// entre :::assinaturas e ::: viram o bloco de fecho, que não pode quebrar no
// meio de uma página.
export function parseContractBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let lista: string[] | null = null;
  let assinaturas: string[] | null = null;

  const fecharLista = () => {
    if (lista?.length) blocks.push({ kind: "lista", items: lista });
    lista = null;
  };

  for (const linha of text.split("\n")) {
    if (assinaturas) {
      if (linha.trim() === ":::") {
        blocks.push({ kind: "assinaturas", text: assinaturas.join("\n").trim() });
        assinaturas = null;
      } else {
        assinaturas.push(linha);
      }
      continue;
    }
    if (linha.trim() === ":::assinaturas") {
      fecharLista();
      assinaturas = [];
      continue;
    }

    const item = /^\s*-\s+(.*)$/.exec(linha);
    if (item) {
      (lista ??= []).push(item[1]);
      continue;
    }
    fecharLista();

    const conteudo = linha.trim();
    if (!conteudo) continue;
    if (conteudo.startsWith("## ")) blocks.push({ kind: "clausula", text: conteudo.slice(3).trim() });
    else if (conteudo.startsWith("# ")) blocks.push({ kind: "titulo", text: conteudo.slice(2).trim() });
    else blocks.push({ kind: "paragrafo", text: conteudo });
  }
  fecharLista();
  if (assinaturas?.length) blocks.push({ kind: "assinaturas", text: assinaturas.join("\n").trim() });
  return blocks;
}

export function ContractDocument({
  body,
  fields,
  paymentMode,
  paymentStructure = "mensal",
  clientName,
  kindLabel,
}: {
  body: string;
  fields: ContractFields;
  paymentMode: "pre" | "pos";
  paymentStructure?: PaymentStructure;
  clientName: string;
  kindLabel: string;
}) {
  const { text } = renderContract(body, fields, paymentMode, paymentStructure);
  const blocks = parseContractBlocks(text);

  return (
    <article className="contract-doc">
      {/* Cabeçalho fixo: na impressão ele se repete em toda página, igual ao
          contrato que a casa já mandava. */}
      <div className="contract-doc-header">
        <Image src="/brand/vizantu-dark.svg" width={1518} height={296} alt="Vizantu" />
        <span>{[clientName, kindLabel].filter(Boolean).join("  |  ")}</span>
      </div>
      <div className="contract-doc-body">
        {blocks.map((block, index) => {
          if (block.kind === "titulo") return <h1 key={index}>{renderInline(block.text, String(index))}</h1>;
          if (block.kind === "clausula") return <h2 key={index}>{renderInline(block.text, String(index))}</h2>;
          if (block.kind === "lista") {
            return (
              <ul key={index}>
                {block.items.map((item, i) => <li key={i}>{renderInline(item, `${index}-${i}`)}</li>)}
              </ul>
            );
          }
          if (block.kind === "assinaturas") {
            return (
              <div className="contract-signatures" key={index}>
                {block.text.split("\n\n").map((parte, i) => (
                  <p key={i}>
                    {parte.split("\n").map((linha, j) => (
                      <span key={j}>{renderInline(linha, `${index}-${i}-${j}`)}{j < parte.split("\n").length - 1 ? <br /> : null}</span>
                    ))}
                  </p>
                ))}
              </div>
            );
          }
          return <p key={index}>{renderInline(block.text, String(index))}</p>;
        })}
      </div>
    </article>
  );
}
