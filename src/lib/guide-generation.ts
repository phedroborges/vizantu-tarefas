// Monta o guia do cliente a partir das fontes (reuniões, transcrições,
// anotações). O ponto todo é assimilar VÁRIAS de uma vez: antes de o trabalho
// começar o dono faz três ou quatro reuniões, e cada uma traz um pedaço.
// Reunião 1 descobre quem é o cliente, reunião 3 descobre no que ele é
// enjoado, reunião 4 muda a estratégia que foi combinada na 2.
//
// Por isso a geração não é incremental: ela relê tudo e reescreve o guia
// inteiro. Remendar texto anterior com informação nova produz guia
// contraditório, onde a estratégia antiga convive com a nova. Relendo tudo,
// o que vale é sempre a informação mais recente, e a IA é instruída a tratar
// conflito assim.
//
// O que ela NÃO toca: campo corrigido à mão (ver saveGeneratedGuide em
// storage.ts). Esse filtro acontece na gravação, não aqui.

import OpenAI from "openai";
import { CLIENT_GUIDE_BLOCKS, CLIENT_GUIDE_FIELD_KEYS, isGuideFieldKey } from "./client-guide";
import type { ProjectProfile, ProjectSource } from "./types";

const MODEL = "gpt-4o";

// Transcrição de reunião é longa. Quatro reuniões de uma hora dão perto de
// 200 mil caracteres, o que estoura a janela e sai caro. O corte é por fonte
// e preserva o começo e o fim de cada uma, porque é no fim da reunião que
// costumam ficar os combinados.
const MAX_CHARS_POR_FONTE = 24_000;
const MAX_CHARS_TOTAL = 160_000;

function recortar(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  const metade = Math.floor(limite / 2);
  return `${texto.slice(0, metade)}\n\n[...trecho do meio omitido por tamanho...]\n\n${texto.slice(-metade)}`;
}

function montarDossie(sources: ProjectSource[]): string {
  const partes: string[] = [];
  let usado = 0;

  // Mais recente primeiro: se o total estourar, quem fica de fora é a reunião
  // mais antiga, que é a que tem mais chance de estar desatualizada.
  const ordenadas = [...sources].sort((a, b) => {
    const da = a.happenedOn || a.createdAt;
    const db = b.happenedOn || b.createdAt;
    return db.localeCompare(da);
  });

  for (const fonte of ordenadas) {
    const corpo = recortar(fonte.content.trim(), MAX_CHARS_POR_FONTE);
    if (usado + corpo.length > MAX_CHARS_TOTAL) break;
    usado += corpo.length;
    const quando = fonte.happenedOn ? ` — ${fonte.happenedOn}` : "";
    partes.push(`### ${fonte.title}${quando} (${fonte.kind})\n\n${corpo}`);
  }

  return partes.join("\n\n---\n\n");
}

function descreverCampos(): string {
  return CLIENT_GUIDE_BLOCKS.map((bloco) => {
    const campos = bloco.campos.map((campo) => `  - "${campo.key}": ${campo.pergunta} ${campo.ajuda}`).join("\n");
    return `${bloco.titulo} (${bloco.resumo})\n${campos}`;
  }).join("\n\n");
}

const REGRAS_DE_ESCRITA = `
Escreva em português brasileiro, do jeito que uma pessoa escreve numa conversa
profissional. Sem travessão. Sem dois-pontos artificial em título ou frase de
efeito. Frases curtas e completas, ligadas por e, mas, porque, por isso.
O texto é lido pela equipe interna antes de produzir conteúdo, então seja
concreto: prefira o detalhe que muda uma decisão ao adjetivo genérico.
`.trim();

export type GuideGenerationResult = {
  guia: Partial<ProjectProfile>;
  camposPreenchidos: string[];
  fontesLidas: number;
};

export async function generateClientGuide(input: {
  apiKey: string;
  projectName: string;
  clientName?: string;
  sources: ProjectSource[];
  // Campos que a pessoa corrigiu à mão. A IA recebe o conteúdo deles como
  // verdade e não pode contradizer, mesmo que as fontes digam outra coisa.
  camposManuais: Partial<ProjectProfile>;
}): Promise<GuideGenerationResult> {
  const dossie = montarDossie(input.sources);
  if (!dossie.trim()) {
    return { guia: {}, camposPreenchidos: [], fontesLidas: 0 };
  }

  const manuais = Object.entries(input.camposManuais)
    .filter(([chave, valor]) => isGuideFieldKey(chave) && String(valor ?? "").trim())
    .map(([chave, valor]) => `- ${chave}: ${valor}`)
    .join("\n");

  const system = `Você monta o guia interno de um cliente da Vizantu, uma agência de marketing.

O guia é lido pela equipe de criação antes de produzir qualquer conteúdo. Ele responde perguntas específicas sobre o cliente a partir do que foi dito nas reuniões.

Campos do guia:

${descreverCampos()}

${REGRAS_DE_ESCRITA}

Regras da extração:

1. Responda SÓ com o que as fontes sustentam. Nunca invente fato sobre o cliente.
2. Se as fontes não respondem um campo, devolva ele como string vazia. Campo vazio é informação honesta, campo inventado destrói a confiança no guia inteiro.
3. As fontes vêm da mais recente para a mais antiga. Se duas se contradizem, vale a mais recente, e vale dizer no texto que mudou (por exemplo, "a estratégia era X e mudou para Y na reunião de março").
4. Não repita a mesma informação em vários campos. Cada campo responde a pergunta dele.
5. Em temasSugeridos e formatosSugeridos, escreva um item por linha, sem numerar.
6. Em tamanhoCamiseta, devolva só PP, P, M, G, GG ou XG. Se ninguém disse, devolva string vazia.
7. Fale do cliente em terceira pessoa. Não escreva "você" nem "nós" dentro das respostas.

Responda em JSON com exatamente estas chaves: ${CLIENT_GUIDE_FIELD_KEYS.join(", ")}.`;

  const user = `Cliente: ${input.clientName || input.projectName}
Projeto: ${input.projectName}

${manuais ? `Estes campos já foram corrigidos à mão pelo dono da agência. Trate como verdade e NÃO contradiga:\n\n${manuais}\n\n` : ""}Fontes, da mais recente para a mais antiga:

${dossie}`;

  const client = new OpenAI({ apiKey: input.apiKey });
  const resposta = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const bruto = resposta.choices[0]?.message?.content?.trim();
  if (!bruto) throw new Error("A IA não devolveu conteúdo.");

  let objeto: Record<string, unknown>;
  try {
    objeto = JSON.parse(bruto) as Record<string, unknown>;
  } catch {
    throw new Error("A IA devolveu uma resposta que não é JSON válido.");
  }

  const guia: Partial<ProjectProfile> = {};
  const camposPreenchidos: string[] = [];
  for (const [chave, valor] of Object.entries(objeto)) {
    if (!isGuideFieldKey(chave)) continue;
    const texto = String(valor ?? "").trim();
    if (!texto) continue;
    guia[chave] = texto;
    camposPreenchidos.push(chave);
  }

  return { guia, camposPreenchidos, fontesLidas: input.sources.length };
}
