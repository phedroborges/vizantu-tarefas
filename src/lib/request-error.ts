// O outro lado da mesma promessa (ver api-error.ts): transformar uma resposta
// ruim numa frase verdadeira, dentro do navegador.
//
// Duas coisas diferentes viravam a mesma mensagem e por isso a tela mentia.
// Uma é o fetch estourar, que aí sim é conexão. A outra é o servidor
// responder um erro que não é JSON, que é onde `await response.json()`
// explodia e caía no mesmo catch de conexão. Aqui elas ficam separadas.

// Resposta que chegou, mas não deu certo. Lê o corpo UMA vez como texto: se
// for o JSON { error } das nossas rotas, usa a frase de lá; se for a página
// de erro do Next (ou qualquer outra coisa), pelo menos diz o status em vez
// de inventar uma causa.
export async function responseError(response: Response, action: string): Promise<string> {
  let raw = "";
  try {
    raw = await response.text();
  } catch {
    raw = "";
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
    } catch {
      // Não era JSON. Segue pro texto por status abaixo.
    }
  }

  if (response.status === 401) return "Sua sessão expirou. Entre de novo para continuar.";
  if (response.status === 403) return `Seu acesso não permite ${action}.`;
  if (response.status === 404) return `Não foi possível ${action}. O item não existe mais.`;
  if (response.status === 413) return `Não foi possível ${action}. O arquivo é grande demais.`;
  return `Não foi possível ${action}. O servidor respondeu com erro ${response.status} e não explicou o motivo.`;
}

// O fetch estourou: nenhuma resposta chegou. Só AQUI faz sentido falar em
// conexão.
export function networkError(action: string): string {
  return `Não foi possível ${action}. O servidor não respondeu, confira sua conexão e tente de novo.`;
}
