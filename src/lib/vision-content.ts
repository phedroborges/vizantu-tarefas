import { promises as fs } from "fs";
import path from "path";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

// A OpenAI busca a URL da imagem pelos próprios servidores dela — não
// conseguiria alcançar um "/uploads/..." servido só em localhost. Por isso
// sempre reconstruímos como data URL (base64) a partir do arquivo salvo em
// public/uploads, o que funciona tanto em dev quanto em produção.
async function imageUrlToDataUrl(url: string): Promise<string | null> {
  if (!url.startsWith("/uploads/")) return null;
  const extension = url.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime) return null;
  try {
    const buffer = await fs.readFile(path.join(process.cwd(), "public", url));
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

// Devolve string simples quando não há imagem (caso comum, mais leve) ou um
// array de partes (texto + imagens) quando há — só assim o modelo realmente
// "vê" o que foi anexado.
export async function buildMessageContent(text: string, images?: string[]): Promise<string | ChatCompletionContentPart[]> {
  if (!images?.length) return text;
  const parts: ChatCompletionContentPart[] = [{ type: "text", text: text || "(imagem sem legenda)" }];
  for (const url of images) {
    const dataUrl = await imageUrlToDataUrl(url);
    if (dataUrl) parts.push({ type: "image_url", image_url: { url: dataUrl } });
  }
  return parts;
}
