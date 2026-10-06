export type StatementAssets = { logo: string; regular: string; semibold: string };

let assetsPromise: Promise<StatementAssets> | undefined;

// Same-origin assets, loaded only when exporting. A failure can be retried.
export function loadStatementAssets(): Promise<StatementAssets> {
  assetsPromise ??= Promise.all([
    "/brand/vizantu-pdf.png", "/fonts/vizantu-pdf-regular.ttf", "/fonts/vizantu-pdf-semibold.ttf",
  ].map(async (path) => {
    const response = await fetch(path, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("Não foi possível carregar a identidade visual do PDF. Tente novamente.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(binary);
  })).then(([logo, regular, semibold]) => ({ logo, regular, semibold })).catch((error) => {
    assetsPromise = undefined;
    throw error;
  });
  return assetsPromise;
}
