import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ASSISTANT_TOOLS, PendingDeleteConfirmation, executeTool } from "@/lib/assistant-tools";
import { isResponse, requireUser } from "@/lib/authz";
import { todayIso } from "@/lib/dates";
import { appendAssistantMessages, deleteTask, getAssistantConversation, listKnowledgeDocs } from "@/lib/storage";
import { buildMessageContent } from "@/lib/vision-content";

const MODEL = "gpt-4o-mini";
const MAX_ROUNDS = 6;
const MAX_HISTORY = 16;

// Abaixo desse tanto de documentos, listar todos os títulos pro modelo julgar
// por conta própria (semântica de verdade, não substring) custa poucos tokens
// e acerta mais que busca por palavra-chave. Acima disso, listar tudo começa
// a pesar e a busca por trecho (que não cresce com a quantidade de
// documentos, sempre limitada a poucos resultados) compensa mais.
const KNOWLEDGE_TITLE_LISTING_THRESHOLD = 40;

// Resumo de prazos ao abrir o widget — cálculo local, zero chamadas à OpenAI.
export async function GET() {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;
  if (!auth.aiEnabled) return NextResponse.json({ overdue: [], upcoming: [] });
  const summary = (await executeTool("get_deadlines_summary", "{}", auth)) as {
    overdue: { name: string }[];
    upcoming: { name: string }[];
  };
  return NextResponse.json(summary);
}

function systemPrompt(knowledgeDocCount: number, pageContext?: string) {
  const knowledgeStrategy =
    knowledgeDocCount === 0
      ? `Base de conhecimento (processos e padrões da Vizantu): ainda não há nenhum documento cadastrado. Se o usuário perguntar "como fazer X" ou "como funciona Y", diga que não está documentado e ofereça escrever junto com ele agora; quando chegarem a um texto combinado, salve com upsert_knowledge_doc.`
      : knowledgeDocCount <= KNOWLEDGE_TITLE_LISTING_THRESHOLD
        ? `Base de conhecimento (processos e padrões da Vizantu — hoje tem ${knowledgeDocCount} documento(s), um número pequeno): quando o usuário perguntar "como fazer X" ou "como funciona Y" na Vizantu, chame list_knowledge_docs primeiro (só os títulos, é barato) e escolha pelo SEU PRÓPRIO entendimento do significado do título — não precisa bater palavra por palavra. Só chame get_knowledge_doc no(s) 1-2 documentos que fazem sentido pelo título. Se nenhum título parecer relacionado, chame search_knowledge_docs como segunda tentativa (ela busca também no conteúdo, não só no título) antes de desistir. Se mesmo assim nada aparecer, diga que não está documentado e ofereça escrever junto com o usuário agora; quando chegarem a um texto combinado, salve com upsert_knowledge_doc (um documento novo e focado nesse assunto — prefira vários documentos pequenos e específicos a um documento gigante com tudo).`
        : `Base de conhecimento (processos e padrões da Vizantu — hoje tem ${knowledgeDocCount} documentos, um número grande): NÃO chame list_knowledge_docs para isso — listar todos os títulos de tantos documentos gasta tokens à toa. Em vez disso, quando o usuário perguntar "como fazer X" ou "como funciona Y", chame search_knowledge_docs com as palavras-chave da pergunta primeiro. Isso devolve só um TRECHO de cada documento relevante, não o conteúdo inteiro — leia os trechos e só então chame get_knowledge_doc no(s) documento(s) que realmente respondem (no máximo 1 ou 2). Se a busca não achar nada relevante, diga que ainda não está documentado e ofereça escrever junto com o usuário agora; quando chegarem a um texto combinado, salve com upsert_knowledge_doc (um documento novo e focado nesse assunto).`;

  return `Você é o parceiro de operação do time da Vizantu dentro do Vizantu Tarefas. Hoje é ${todayIso()}.
Você NÃO é um robô de consulta só-leitura — você tem acesso completo para ler E EDITAR tudo no app. Aja, não apenas informe.

O que você pode fazer de verdade, usando as ferramentas (nunca invente dados, nunca diga "não consigo fazer isso" se existe uma ferramenta pra isso):
- Tarefas: criar (create_task), e EDITAR QUALQUER CAMPO de uma tarefa existente (update_task) — nome, projeto, responsável, prazo, formato, canal, link do drive, descrição/roteiro e status. Isso inclui coisas como "muda o canal pra X", "renomeia a tarefa", "coloca em revisão", "atualiza o roteiro/briefing", "tira o responsável", "move pro projeto Y".
- Comentários: adicionar um comentário no histórico de uma tarefa (add_comment) sempre que o usuário pedir para registrar algo nela.
- Exclusão: chame delete_task; o usuário confirma na tela antes de apagar de verdade — não peça confirmação por texto, só chame a ferramenta.
- Prazos: get_deadlines_summary para atrasos e entregas próximas.
- Imagens: o usuário pode anexar prints, fotos ou referências visuais. Você TEM visão de verdade — qualquer imagem anexada já foi processada e está diante de você. Nunca diga "não consigo ver imagens" ou algo parecido; descreva e comente o que for relevante nela (ex.: um print de uma tela com erro, uma referência de arte, um rascunho de post) antes ou junto da ação pedida.
- ${knowledgeStrategy}

Como agir:
- Toda ferramenta que precisa de um ID (taskId) — descubra primeiro com list_tasks antes de editar. Não peça o ID pro usuário.
- Quando o usuário descrever a tarefa por palavras do TÍTULO (ex.: "a tarefa do roteiro do post...", "aquela do carrossel"), use o parâmetro query de list_tasks (busca no nome) — nunca tente encaixar essas palavras no parâmetro status. Status é só um dos 12 valores fixos do pipeline; se o usuário mencionar uma palavra que não é claramente um desses 12 valores, é quase certo que ele está descrevendo o título, não o status. Se a primeira busca não achar nada, tente de novo com menos palavras (só o termo mais distintivo) antes de dizer que não existe.
- Se o nome da tarefa/projeto/pessoa citado bate com um resultado só, aja direto. Se houver mais de um resultado plausível, pergunte rapidamente qual é, em vez de adivinhar ou de desistir.
- Depois de qualquer edição, confirme em 1 frase curta o que mudou.
- Só chame uma ferramenta quando ela realmente ajuda a responder o pedido atual — não explore dados "por curiosidade".
- Roteiro de vídeo (reels, institucional, demonstração) tem padrão próprio na casa: cena, fala e lettering, e o lettering só pode repetir duas ou três palavras que já estão na fala. Antes de escrever ou revisar um roteiro de vídeo, leia o documento da base de conhecimento sobre roteiro de vídeo e siga o formato dele — é o que faz o roteiro virar tabela na tela do cliente.
- Responda em português, direto e curto — sem enrolação, mas sem economizar em fazer o que foi pedido.${
    pageContext ? `\n\nContexto da tela atual do usuário (este é o chat rápido, preso à tela — use isso pra entender perguntas curtas como "o que acha disso", "essa tarefa está atrasada?" ou "muda o status dela"): ${pageContext}` : ""
  }`;
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (isResponse(auth)) return auth;

  const body = await request.json();
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined;

  // Persiste a resposta final na conversa (quando existe uma) e devolve pro
  // cliente — um só lugar pros três pontos de retorno do loop abaixo.
  async function finish(message: string, pendingConfirmation?: { taskId: string; taskName: string }) {
    if (conversationId) {
      await appendAssistantMessages(conversationId, [{ id: crypto.randomUUID(), role: "assistant", text: message, pendingConfirmation: pendingConfirmation ?? null }]);
    }
    return NextResponse.json(pendingConfirmation ? { message, pendingConfirmation } : { message });
  }

  // Atalho de confirmação de exclusão — não passa pela OpenAI, custo zero.
  // Ainda assim é uma mutação: visualizador não pode confirmar.
  if (body.confirmDeleteTaskId) {
    if (auth.role === "visualizador") {
      return NextResponse.json({ error: "Seu acesso é somente leitura." }, { status: 403 });
    }
    const removed = await deleteTask(body.confirmDeleteTaskId);
    return finish(removed ? "Tarefa excluída." : "Não encontrei essa tarefa — talvez já tenha sido excluída.");
  }

  if (!auth.aiEnabled) {
    return NextResponse.json({ error: "O assistente de IA não está disponível para o seu usuário." }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor. Adicione a chave em .env.local e reinicie o servidor." },
      { status: 500 },
    );
  }

  // Custo zero de IA — só pra decidir a estratégia de busca na base de
  // conhecimento (títulos direto vs. busca por trecho) de acordo com o
  // tamanho real da base agora, sem precisar advinhar um número fixo.
  const knowledgeDocCount = (await listKnowledgeDocs()).length;
  const pageContext = typeof body.pageContext === "string" ? body.pageContext : undefined;

  const incomingImages: string[] | undefined = Array.isArray(body.images) && body.images.length ? body.images.filter((u: unknown) => typeof u === "string") : undefined;

  let incoming: ChatCompletionMessageParam[];
  if (conversationId) {
    // Modo autoritativo: o cliente manda só a mensagem nova, o histórico vem
    // do que já está salvo — evita reenviar (e retrimar) o histórico inteiro
    // a cada turno, e é o que permite reabrir a conversa depois de recarregar
    // a página.
    const conversation = await getAssistantConversation(conversationId);
    if (!conversation) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    const userText = typeof body.message === "string" ? body.message.trim() : "";
    if (!userText && !incomingImages) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
    const userMessage = { id: crypto.randomUUID(), role: "user" as const, text: userText, images: incomingImages, pendingConfirmation: null };
    await appendAssistantMessages(conversationId, [userMessage]);
    const historySlice = [...conversation.messages, userMessage].slice(-MAX_HISTORY);
    incoming = historySlice.map((m) => ({ role: m.role, content: buildMessageContent(m.text, m.images) }) as ChatCompletionMessageParam);
  } else {
    // Modo legado, usado pelo widget pequeno: ephemeral, sem persistir nada.
    type LegacyIncoming = { role: "user" | "assistant"; content: string; images?: string[] };
    const legacyMessages: LegacyIncoming[] = (body.messages ?? []).slice(-MAX_HISTORY);
    incoming = legacyMessages.map((m) => ({ role: m.role, content: buildMessageContent(m.content, m.images) }) as ChatCompletionMessageParam);
  }

  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt(knowledgeDocCount, pageContext) }, ...incoming];

  const client = new OpenAI({ apiKey });

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: ASSISTANT_TOOLS,
      tool_choice: "auto",
      max_tokens: 500,
    });

    const responseMessage = completion.choices[0].message;
    messages.push(responseMessage);

    if (!responseMessage.tool_calls?.length) {
      return finish(responseMessage.content || "");
    }

    for (const toolCall of responseMessage.tool_calls) {
      if (toolCall.type !== "function") continue;
      const result = await executeTool(toolCall.function.name, toolCall.function.arguments, auth);

      if (result instanceof PendingDeleteConfirmation) {
        // Corta o loop aqui — a frase é montada localmente (sem custo extra
        // de IA) e o front mostra o botão de confirmar.
        return finish(`Posso excluir a tarefa "${result.taskName}"? Confirme abaixo.`, { taskId: result.taskId, taskName: result.taskName });
      }

      messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }

  return finish("Não consegui concluir esse pedido — tenta reformular?");
}
