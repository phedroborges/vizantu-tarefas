"use client";

import { networkError, responseError } from "@/lib/request-error";

// O gravador do navegador entrega "audio/webm;codecs=opus" (ou mp4 no Safari).
// A extensão só precisa bater com o contêiner.
function extensionFor(type: string): string {
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("wav")) return "wav";
  return "webm";
}

export async function uploadAudioBlob(blob: Blob): Promise<string> {
  const type = blob.type || "audio/webm";
  const formData = new FormData();
  formData.append("file", new File([blob], `audio.${extensionFor(type)}`, { type }));
  let response: Response;
  try {
    response = await fetch("/api/uploads", { method: "POST", body: formData });
  } catch {
    throw new Error(networkError("enviar o áudio"));
  }
  if (!response.ok) throw new Error(await responseError(response, "enviar o áudio"));
  const result = await response.json().catch(() => ({}));
  if (!result.url) throw new Error("Não foi possível enviar o áudio. O servidor respondeu sem o endereço do arquivo.");
  return result.url as string;
}
