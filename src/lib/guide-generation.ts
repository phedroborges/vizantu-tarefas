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
// Uma chamada por BLOCO, não uma para o guia inteiro. A primeira versão fazia
// tudo de uma vez e o resultado foram campos de 26 caracteres: com dezoito
// perguntas na mesma resposta, o modelo distribui pouco para cada uma e
// entrega manchete em vez de contexto. Cinco chamadas em paralelo custam mais
// entrada e resolvem isso, porque cada uma tem duas a seis perguntas e espaço
// para responder de verdade.
//
// O que ela NÃO toca: campo corrigido à mão (ver saveGeneratedGuide em
// storage.ts). Esse filtro acontece na gravação, não aqui.

import OpenAI from "openai";
import { CLIENT_GUIDE_BLOCKS, isGuideFieldKey, type GuideBlock } from "./client-guide";
import type { ProjectProfile, ProjectSource } from "./types";

const MODEL = "gpt-4o";

// Transcrição de reunião é longa. Quatro reuniões de uma hora dão perto de
// 200 mil caracteres, o que estoura a janela e sai caro. O corte é por fonte
// e preserva o começo e o fim de cada uma, porque é no fim da reunião que
// costumam ficar os combinados.
const MAX_CHARS_POR_FONTE = 24_000;
const MAX_CHARS_TOTAL = 160_000;

// Teto por bloco. O padrão do gpt-4o é 4096 e um bloco de seis perguntas
// respondidas com profundidade passa disso, o que cortaria o JSON no meio.
const MAX_TOKENS_POR_BLOCO = 6_000;

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

// As regras de profundidade. São o coração do prompt, porque o erro da
// primeira versão não foi alucinação, foi brevidade: o modelo resumia quando
// a tarefa é transferir. Pedir "seja concreto" não resolve, precisa dizer o
// que fazer com cada tipo de campo e o que conta como resposta pronta.
const REGRAS_DE_PROFUNDIDADE = `
Esta tarefa é EXTRAÇÃO e ORGANIZAÇÃO, não resumo. Você não está condensando as
fontes, está transferindo para o campo certo tudo que elas dizem sobre aquela
pergunta. Se a fonte traz dez detalhes sobre um campo, os dez entram.

Nunca responda com uma frase só quando a fonte permite mais. Campo de uma linha
não serve para a equipe: quem lê está prestes a produzir conteúdo e precisa
saber o suficiente para decidir sozinho.

Alvo por tipo de campo:

- Campo de texto longo: de dois a cinco parágrafos curtos quando a fonte
  sustenta. Cada parágrafo traz uma informação nova, sem repetir o anterior com
  outras palavras.
- Campo de lista (temas, formatos, referências): TODOS os itens que aparecem
  nas fontes, um por linha, sem numerar. Não escolha os melhores, traga todos.
  Se a fonte diz que algo foi testado e não funcionou, diga isso na linha.
- Campo curto: uma linha direta.
- Campo de escolha: só o valor.

Puxe o detalhe concreto sempre que existir: nome de pessoa, nome de lugar,
data, horário, número, preço, quantidade, nome de concorrente, nome de produto.
É o detalhe que faz a equipe acertar. Adjetivo genérico ("é exigente", "quer
crescer") sem o fato que o sustenta não vale nada.

Quando o cliente disse algo de um jeito marcante, cite a frase dele entre
aspas dentro da resposta. A forma como ele fala é informação.
`.trim();

const REGRAS_DE_HONESTIDADE = `
Nunca invente fato sobre o cliente. Isso vale para o FATO, não para o nível de
detalhe: ser minucioso com o que a fonte diz é obrigatório, inventar o que ela
não diz é proibido.

Se as fontes não tocam no assunto de um campo, devolva string vazia. Campo
vazio é informação honesta.

Se as fontes respondem só em parte, escreva o que elas dizem e feche com uma
linha começando por "Ainda não sabemos:" listando o que falta descobrir. Isso
serve duas vezes, porque a equipe entende o limite do que está ali e o dono
sabe o que perguntar na próxima reunião.
`.trim();

const REGRAS_DE_ESCRITA = `
Escreva em português brasileiro, do jeito que uma pessoa escreve numa conversa
profissional. Sem travessão. Sem dois-pontos artificial em título ou frase de
efeito. Frases curtas e completas, ligadas por e, mas, porque, por isso.

Fale do cliente em terceira pessoa. Não escreva "você" nem "nós" dentro das
respostas. Não repita a mesma informação em campos diferentes, porque cada
campo responde a pergunta dele.
`.trim();

function promptDoBloco(bloco: GuideBlock): string {
  const campos = bloco.campos
    .map((campo) => {
      const tipo = campo.kind === "escolha"
        ? `escolha, entre ${campo.opcoes?.join(", ")}, ou vazio`
        : campo.kind === "curto" ? "uma linha" : "texto longo";
      return `- "${campo.key}" (${tipo})\n  Pergunta: ${campo.pergunta}\n  O que entra aqui: ${campo.ajuda}`;
    })
    .join("\n");

  return `Você monta uma parte do guia interno de um cliente da Vizantu, uma agência de marketing.

O guia é lido pela equipe de criação antes de produzir qualquer conteúdo para esse cliente.

Sua parte agora é o bloco "${bloco.titulo}". ${bloco.resumo}

Campos deste bloco:

${campos}

${REGRAS_DE_PROFUNDIDADE}

${REGRAS_DE_HONESTIDADE}

${REGRAS_DE_ESCRITA}

Responda em JSON com exatamente estas chaves: ${bloco.campos.map((campo) => campo.key).join(", ")}.
Não inclua nenhuma outra chave.`;
}

export type GuideGenerationResult = {
  guia: Partial<ProjectProfile>;
  camposPreenchidos: string[];
  fontesLidas: number;
  // Blocos que falharam. Um bloco que quebra não derruba os outros quatro,
  // então a tela precisa poder dizer o que ficou de fora.
  blocosComErro: string[];
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
    return { guia: {}, camposPreenchidos: [], fontesLidas: 0, blocosComErro: [] };
  }

  const manuais = Object.entries(input.camposManuais)
    .filter(([chave, valor]) => isGuideFieldKey(chave) && String(valor ?? "").trim())
    .map(([chave, valor]) => `- ${chave}: ${valor}`)
    .join("\n");

  const contexto = `Cliente: ${input.clientName || input.projectName}
Projeto: ${input.projectName}

${manuais ? `Estes campos já foram corrigidos à mão pelo dono da agência. Trate como verdade e NÃO contradiga:\n\n${manuais}\n\n` : ""}Fontes, da mais recente para a mais antiga:

${dossie}`;

  const client = new OpenAI({ apiKey: input.apiKey });

  // Em paralelo: cinco chamadas independentes, e o tempo total é o da mais
  // lenta e não a soma.
  const resultados = await Promise.all(
    CLIENT_GUIDE_BLOCKS.map(async (bloco) => {
      try {
        const resposta = await client.chat.completions.create({
          model: MODEL,
          temperature: 0.3,
          max_tokens: MAX_TOKENS_POR_BLOCO,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: promptDoBloco(bloco) },
            { role: "user", content: contexto },
          ],
        });
        const bruto = resposta.choices[0]?.message?.content?.trim();
        if (!bruto) return { bloco, objeto: null };
        return { bloco, objeto: JSON.parse(bruto) as Record<string, unknown> };
      } catch {
        return { bloco, objeto: null };
      }
    }),
  );

  const guia: Partial<ProjectProfile> = {};
  const camposPreenchidos: string[] = [];
  const blocosComErro: string[] = [];

  for (const { bloco, objeto } of resultados) {
    if (!objeto) {
      blocosComErro.push(bloco.titulo);
      continue;
    }
    for (const [chave, valor] of Object.entries(objeto)) {
      if (!isGuideFieldKey(chave)) continue;
      const texto = String(valor ?? "").trim();
      if (!texto) continue;
      guia[chave] = texto;
      camposPreenchidos.push(chave);
    }
  }

  // Todos os blocos falharam: é erro de verdade (chave inválida, modelo fora
  // do ar) e precisa subir, senão a tela diz "preenchi 0 campos" como se as
  // fontes fossem ruins.
  if (blocosComErro.length === CLIENT_GUIDE_BLOCKS.length) {
    throw new Error("Nenhum bloco do guia pôde ser gerado. Verifique a chave da OpenAI e tente de novo.");
  }

  return { guia, camposPreenchidos, fontesLidas: input.sources.length, blocosComErro };
}
