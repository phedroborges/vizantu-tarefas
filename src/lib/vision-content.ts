import type { ChatCompletionContentPart } from "openai/resources/chat/completions";

// As imagens anexadas vêm do Supabase Storage (bucket público) — já são URLs
// https reais, que os servidores da OpenAI conseguem buscar direto. Nada de
// ler arquivo local nem converter pra base64.

// Devolve string simples quando não há imagem (caso comum, mais leve) ou um
// array de partes (texto + imagens) quando há — só assim o modelo realmente
// "vê" o que foi anexado.
export function buildMessageContent(text: string, images?: string[]): string | ChatCompletionContentPart[] {
  if (!images?.length) return text;
  const parts: ChatCompletionContentPart[] = [{ type: "text", text: text || "(imagem sem legenda)" }];
  for (const url of images) parts.push({ type: "image_url", image_url: { url } });
  return parts;
}
