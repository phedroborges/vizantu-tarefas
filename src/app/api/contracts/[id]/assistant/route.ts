import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { apiFailure } from "@/lib/api-error";
import { isResponse, requireUser } from "@/lib/authz";
import { CONTRACT_FIELDS, PAYMENT_STRUCTURES } from "@/lib/contract-templates";
import { renderContract } from "@/lib/contract-render";
import { getContract, listKnowledgeDocs, updateContract } from "@/lib/storage";
import { todayIso } from "@/lib/dates";

// A IA do contrato é outra coisa da IA de tarefas, e por isso mora numa rota
// própria em vez de ganhar mais ferramentas na de sempre.
//
// A diferença que importa não é o conjunto de ferramentas, é o contexto: aqui
// o documento inteiro entra no prompt. Ela não precisa procurar o contrato,
// nem adivinhar qual cláusula é a 7, nem perguntar o que está escrito. Ela
// está lendo o mesmo texto que você, e é isso que faz "reescreve a cláusula de
// rescisão pra 60 dias" virar uma edição certa em vez de um chute.
//
// Modelo maior que o do assistente de tarefas de propósito: texto de contrato
// é caro de errar e barato de revisar, e o volume aqui é de alguns contratos
// por mês, não de dezenas de perguntas por dia.
const MODEL = "gpt-4o";
const MAX_ROUNDS = 4;
const MAX_HISTORY = 14;

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "set_fields",
      description:
        "Preenche ou corrige campos de DADOS do contrato (razão social, CNPJ, valor, vigência, faixas de escalonamento). Use sempre que o pedido for sobre um valor, uma data, um número ou um dado do cliente. Nunca reescreva uma cláusula para mudar um número que é campo.",
      parameters: {
        type: "object",
        properties: {
          fields: {
            type: "array",
            description: "Os campos a gravar.",
            items: {
              type: "object",
              properties: {
                key: { type: "string", description: "A chave do campo, exatamente como listada no prompt." },
                value: { type: "string", description: "O valor. Em faixas de escalonamento use uma linha por degrau, no formato '3 x 2000'." },
              },
              required: ["key", "value"],
            },
          },
        },
        required: ["fields"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_payment_structure",
      description:
        "Muda como o valor do contrato é montado: 'mensal' (mesma mensalidade), 'escalonado' (valor em degraus) ou 'projeto' (valor fechado em parcelas). Isso reescreve a cláusula 3 inteira e não toca nas outras. Depois de escalonar, grave as faixas com set_fields no campo escalonamento.",
      parameters: {
        type: "object",
        properties: {
          structure: { type: "string", enum: ["mensal", "escalonado", "projeto"] },
          mode: { type: "string", enum: ["pre", "pos"], description: "Opcional. 'pre' paga antes do mês de execução, 'pos' dentro dele." },
        },
        required: ["structure"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_clause",
      description:
        "Substitui o texto de UMA cláusula inteira, da linha '## CLÁUSULA N' até a cláusula seguinte. Use para mudar redação, prazo escrito na cláusula, obrigação ou condição. Reescreva a cláusula completa, com o cabeçalho e todos os itens numerados dela.",
      parameters: {
        type: "object",
        properties: {
          numero: { type: "integer", description: "O número da cláusula a substituir." },
          texto: { type: "string", description: "A cláusula completa, começando por '## CLÁUSULA N – TÍTULO'." },
        },
        required: ["numero", "texto"],
      },
    },
  },
];

function systemPrompt(contract: Awaited<ReturnType<typeof getContract>>, documento: string, faltando: string[], padroes: string): string {
  const campos = CONTRACT_FIELDS.map((f) => `- ${f.key}: ${f.label}${f.hint ? ` (${f.hint})` : ""}`).join("\n");
  const preenchidos = Object.entries(contract!.fields)
    .filter(([, v]) => String(v).trim())
    .map(([k, v]) => `- ${k} = ${String(v).replace(/\n/g, " | ")}`)
    .join("\n") || "- nenhum campo preenchido ainda";

  return `Você é o redator de contratos da Vizantu. Hoje é ${todayIso()}. Você trabalha COM o Phedro em cima de um contrato específico, que está inteiro abaixo. Aja: edite o contrato com as ferramentas em vez de descrever o que ele deveria fazer.

Como este contrato funciona, e isso é o mais importante que você precisa entender:

1. O texto tem {{campos}} que são preenchidos com os DADOS. Número, valor, data, nome, CNPJ, quantidade: tudo isso é campo, e se muda com set_fields. NUNCA reescreva uma cláusula só para trocar um número que já é campo. Se o pedido é "muda o valor para 3 mil", é set_fields, não edit_clause.
2. O que dá para calcular não é campo e não se escreve: o total, o valor por extenso, a data final da vigência, o primeiro vencimento e a soma dos conteúdos saem sozinhos dos campos. Se te pedirem o total, você confere a conta, não digita o resultado em lugar nenhum.
3. Num contrato escalonado, a vigência e o total saem das FAIXAS. O campo escalonamento recebe uma linha por degrau, no formato "3 x 2000". Três meses a dois mil, três a dois mil e quinhentos e seis a três mil é exatamente: "3 x 2000", "3 x 2500", "6 x 3000". Não preencha vigencia_meses nesse caso, ele é calculado.
4. Marcação do corpo: "# título", "## CLÁUSULA N – TÍTULO", "- item de lista", **negrito**, e {{campo}}. Nada além disso.
5. A numeração é escrita na mão dentro do texto. Se você inserir ou remover uma cláusula, renumere as seguintes e os itens delas (7.1, 7.2...) na mesma edição, senão o contrato sai com duas cláusulas 8.

Estrutura de pagamento hoje: ${PAYMENT_STRUCTURES.find((s) => s.id === contract!.paymentStructure)?.label} (${contract!.paymentStructure}), ${contract!.paymentMode === "pre" ? "pré-pago" : "pós-pago"}.

Campos que existem:
${campos}

Campos preenchidos neste contrato:
${preenchidos}

${faltando.length ? `Ainda faltam, e aparecem marcados no documento: ${faltando.join(", ")}.` : "Nenhum campo pendente."}

${padroes}

Como responder: em português, curto e direto. Depois de editar, diga em uma frase o que mudou. Se o pedido puder virar um contrato pior para a Vizantu (prazo de rescisão menor, escopo aberto, garantia de resultado), faça o que foi pedido e diga em uma linha qual é o risco. Não invente cláusula que não foi pedida.

O CONTRATO, como está agora, já com os campos preenchidos:

${documento}`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["dono"]);
  if (isResponse(auth)) return auth;
  if (!auth.aiEnabled) {
    return NextResponse.json({ error: "O assistente de IA não está disponível para o seu usuário." }, { status: 403 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada no servidor." }, { status: 500 });
  }

  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });

  const body = await request.json();
  const incoming: { role: "user" | "assistant"; content: string }[] = (body.messages ?? []).slice(-MAX_HISTORY);
  if (!incoming.length) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

  // O padrão de escrita da casa vale pro contrato também: é o mesmo documento
  // que a IA de tarefas consulta, e sem ele a redação volta cheia de travessão.
  const docs = await listKnowledgeDocs();
  const escrita = docs.find((doc) => doc.title.toLowerCase().includes("escrita"));
  const padroes = escrita ? `Padrão de escrita da casa, vale para o texto do contrato:\n\n${escrita.content}` : "";

  try {
    const { text, missing } = renderContract(contract.body, contract.fields, contract.paymentMode, contract.paymentStructure);
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt(contract, text, missing, padroes) },
      ...incoming.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
    ];

    const client = new OpenAI({ apiKey });
    // Estado que as ferramentas vão alterando ao longo das rodadas, gravado de
    // uma vez só no fim: uma resposta com três edições não pode deixar o
    // contrato salvo pela metade se a terceira falhar.
    const fields = { ...contract.fields };
    let corpo = contract.body;
    let structure = contract.paymentStructure;
    let mode = contract.paymentMode;
    let mudou = false;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        max_tokens: 2000,
      });
      const message = completion.choices[0].message;
      messages.push(message);

      if (!message.tool_calls?.length) {
        if (mudou) {
          const salvo = await updateContract(id, { fields, body: corpo, paymentStructure: structure, paymentMode: mode });
          return NextResponse.json({ message: message.content || "", contract: salvo });
        }
        return NextResponse.json({ message: message.content || "" });
      }

      for (const call of message.tool_calls) {
        if (call.type !== "function") continue;
        const args = JSON.parse(call.function.arguments || "{}");
        let resultado: unknown = { ok: true };

        if (call.function.name === "set_fields") {
          const validas = new Set(CONTRACT_FIELDS.map((f) => f.key));
          const gravados: string[] = [];
          const recusados: string[] = [];
          for (const { key, value } of args.fields ?? []) {
            if (!validas.has(key)) { recusados.push(key); continue; }
            fields[key] = String(value ?? "");
            gravados.push(key);
          }
          mudou = mudou || gravados.length > 0;
          resultado = { gravados, recusados: recusados.length ? recusados : undefined };
        } else if (call.function.name === "set_payment_structure") {
          const { buildPaymentClause, replacePaymentClause } = await import("@/lib/contract-templates");
          structure = args.structure;
          if (args.mode === "pre" || args.mode === "pos") mode = args.mode;
          corpo = replacePaymentClause(corpo, buildPaymentClause(contract.templateId as never, structure, mode));
          mudou = true;
          resultado = { ok: true, structure, mode };
        } else if (call.function.name === "edit_clause") {
          const numero = Number(args.numero);
          const inicio = corpo.search(new RegExp(`^## CLÁUSULA ${numero}\\b`, "m"));
          if (inicio < 0) {
            resultado = { erro: `Não existe cláusula ${numero} neste contrato.` };
          } else {
            const resto = corpo.slice(inicio);
            const fim = resto.search(new RegExp(`^## CLÁUSULA ${numero + 1}\\b`, "m"));
            corpo = fim < 0 ? corpo.slice(0, inicio) + args.texto : corpo.slice(0, inicio) + args.texto + "\n\n" + resto.slice(fim);
            mudou = true;
          }
        }

        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(resultado) });
      }
    }

    if (mudou) {
      const salvo = await updateContract(id, { fields, body: corpo, paymentStructure: structure, paymentMode: mode });
      return NextResponse.json({ message: "Apliquei as alterações no contrato.", contract: salvo });
    }
    return NextResponse.json({ message: "Não consegui concluir esse pedido, tenta reformular?" });
  } catch (error) {
    return apiFailure(error, "editar o contrato com a IA");
  }
}
