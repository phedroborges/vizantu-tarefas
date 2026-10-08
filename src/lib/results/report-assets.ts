import type { ResultsImage } from "./report-pdf";
import type { ResultsReport } from "./types";

// O PDF aceita JPEG e PNG. Qualquer imagem do relatório é redesenhada num
// canvas e sai como JPEG: resolve WebP, limita o tamanho (um print de 4000 px
// deixaria o arquivo enorme) e entrega a largura e a altura de que o gerador
// precisa para manter a proporção.
const MAX_SIDE = 1600;

async function loadImage(url: string): Promise<ResultsImage> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("imagem indisponível");
  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas indisponível");
  // Fundo branco: transparência de PNG viraria preto no JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL("image/jpeg", 0.88), width: canvas.width, height: canvas.height };
}

/** Carrega as imagens do relatório. A que falhar fica de fora do PDF, e a
 * lista de falhas volta para a tela avisar. */
export async function loadReportImages(report: ResultsReport): Promise<{ images: Record<string, ResultsImage>; failed: string[] }> {
  const urls = [...new Set(report.sections.flatMap((section) => (section.images ?? []).map((image) => image.url)))];
  const images: Record<string, ResultsImage> = {};
  const failed: string[] = [];
  await Promise.all(urls.map(async (url) => {
    try { images[url] = await loadImage(url); } catch { failed.push(url); }
  }));
  return { images, failed };
}
