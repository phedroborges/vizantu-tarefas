import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ASSISTANT_TOOLS, PendingDeleteConfirmation, executeTool } from "@/lib/assistant-tools";
import { todayIso } from "@/lib/dates";
import { deleteTask } from "@/lib/storage";

const MODEL = "gpt-4o-mini";
const MAX_ROUNDS = 4;
const MAX_HISTORY = 12;

// Resumo de prazos ao abrir o widget — cálculo local, zero chamadas à OpenAI.
export async function GET() {
  const summary = (await executeTool("get_deadlines_summary", "{}")) as {
    overdue: { name: string }[];
    upcoming: { name: string }[];
  };
  return NextResponse.json(summary);
}

function systemPrompt() {
  return `Você é o assistente do Vizantu Tarefas, um app de gestão de tarefas de uma agência. Hoje é ${todayIso()}.
Responda em português, de forma direta e curta. Sempre use as ferramentas disponíveis para consultar ou alterar dados reais — nunca invente números, prazos ou nomes de projetos/pessoas.
Para excluir uma tarefa, apenas chame a ferramenta delete_task; o usuário confirma na tela antes de qualquer coisa ser apagada de verdade — você não precisa (e não deve) pedir confirmação por texto, só chame a ferramenta.`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Atalho de confirmação de exclusão — não passa pela OpenAI, custo zero.
  if (body.confirmDeleteTaskId) {
    const removed = await deleteTask(body.confirmDeleteTaskId);
    return NextResponse.json({
      message: removed ? "Tarefa excluída." : "Não encontrei essa tarefa — talvez já tenha sido excluída.",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY não configurada no servidor. Adicione a chave em .env.local e reinicie o servidor." },
      { status: 500 },
    );
  }

  const incoming: ChatCompletionMessageParam[] = (body.messages ?? []).slice(-MAX_HISTORY);
  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: systemPrompt() }, ...incoming];

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
      return NextResponse.json({ message: responseMessage.content || "" });
    }

    for (const toolCall of responseMessage.tool_calls) {
      if (toolCall.type !== "function") continue;
      const result = await executeTool(toolCall.function.name, toolCall.function.arguments);

      if (result instanceof PendingDeleteConfirmation) {
        // Corta o loop aqui — a frase é montada localmente (sem custo extra
        // de IA) e o front mostra o botão de confirmar.
        return NextResponse.json({
          message: `Posso excluir a tarefa "${result.taskName}"? Confirme abaixo.`,
          pendingConfirmation: { taskId: result.taskId, taskName: result.taskName },
        });
      }

      messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }

  return NextResponse.json({ message: "Não consegui concluir esse pedido — tenta reformular?" });
}
