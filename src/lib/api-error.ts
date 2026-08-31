import { NextResponse } from "next/server";

// O erro que ninguém esperava também precisa chegar em português, dizendo o
// que aconteceu.
//
// Sem isto, uma exceção no meio de uma rota vira a página de erro do Next:
// HTML, em inglês, com um digest no lugar da causa. O navegador tenta ler
// aquilo como JSON, falha, e a tela acaba dizendo "falha de conexão" pra um
// erro que não tem nada a ver com conexão — a conexão funcionou, o servidor
// é que recusou. Foi exatamente assim que uma coluna faltando no banco
// apareceu, na tela de quem estava só colando um link, como problema de
// internet.
//
// Aqui a regra é uma só: a resposta de erro é sempre JSON com { error }, e a
// frase diz de forma direta o que travou e o que fazer.

// Causas que a gente já viu acontecer, traduzidas pra uma frase que serve pra
// alguém do time decidir o que fazer. O que não estiver aqui volta com o
// texto original do banco: técnico, mas verdadeiro — melhor que uma frase
// bonita e errada.
const KNOWN_CAUSES: { match: RegExp; reason: (match: RegExpMatchArray) => string }[] = [
  {
    match: /could not find the '([^']+)' column|column "?([\w.]+)"? does not exist/i,
    reason: (m) => `O banco de dados está sem a coluna ${m[1] || m[2]}. Falta rodar uma migration no Supabase.`,
  },
  {
    match: /violates foreign key constraint/i,
    reason: () => "Algo que essa tarefa aponta não existe mais no banco. Recarregue a página e tente de novo.",
  },
  {
    match: /violates check constraint "?(\w+)"?/i,
    reason: (m) => `O banco recusou um dos valores enviados (regra ${m[1]}).`,
  },
  {
    match: /violates not-null constraint/i,
    reason: () => "Um campo obrigatório chegou vazio no banco.",
  },
  {
    match: /duplicate key value/i,
    reason: () => "Já existe um registro com esse valor.",
  },
  {
    match: /jwt|invalid api key/i,
    reason: () => "A chave de acesso ao banco não foi aceita. Confira as variáveis de ambiente do servidor.",
  },
  {
    match: /fetch failed|econnrefused|etimedout|network/i,
    reason: () => "O banco de dados não respondeu. Tente de novo em alguns segundos.",
  },
];

function causeOf(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  for (const cause of KNOWN_CAUSES) {
    const found = raw.match(cause.match);
    if (found) return cause.reason(found);
  }
  return raw ? `O banco respondeu: ${raw}` : "O servidor não explicou o motivo.";
}

// `action` completa a frase "Não foi possível ___" — escreva no infinitivo e
// do jeito que a pessoa entende o que ela estava fazendo ("salvar a tarefa",
// "excluir a tarefa"), não o nome da rota.
export function failureMessage(error: unknown, action: string): string {
  return `Não foi possível ${action}. ${causeOf(error)}`;
}

export function apiFailure(error: unknown, action: string): NextResponse {
  // O log completo continua indo pro servidor: a tela recebe a frase, quem
  // for investigar recebe a pilha inteira.
  console.error(`[api] falha ao ${action}:`, error);
  return NextResponse.json({ error: failureMessage(error, action) }, { status: 500 });
}
