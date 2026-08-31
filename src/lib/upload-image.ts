"use client";

import { networkError, responseError } from "@/lib/request-error";
import { resizeImageFile } from "@/lib/resize-image";

// Mesmos tipos que /api/uploads aceita — checar aqui evita subir um PDF
// arrastado por engano só pra receber 400 do outro lado.
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function isUploadableImage(file: File): boolean {
  return ACCEPTED.has(file.type);
}

// Pega só as imagens de um paste/drop. Um Ctrl+V de texto normal, ou o arrasto
// de um .zip, devolve lista vazia e quem chamou deixa o navegador seguir o
// comportamento padrão.
export function imagesFromTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter(isUploadableImage);
}

export async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", await resizeImageFile(file));
  let response: Response;
  try {
    response = await fetch("/api/uploads", { method: "POST", body: formData });
  } catch {
    throw new Error(networkError("enviar a imagem"));
  }
  if (!response.ok) throw new Error(await responseError(response, "enviar a imagem"));
  const result = await response.json().catch(() => ({}));
  if (!result.url) throw new Error("Não foi possível enviar a imagem. O servidor respondeu sem o endereço do arquivo.");
  return result.url as string;
}

// O markdown que representa a imagem dentro da descrição. Fica em linha
// própria: colada no meio de uma frase ela quebraria a leitura do roteiro.
export function imageMarkdown(url: string): string {
  return `![](${url})`;
}
