// A única parte do app que conversa com o serviço de WhatsApp.
//
// Hoje o serviço é a Stevo (StevoManager v2). Tudo que é específico dela —
// endereço, cabeçalho, nome dos campos — mora neste arquivo, de propósito:
// trocar de serviço depois é reescrever só aqui, e o resto do app (fila,
// lembretes, comunicados) nem fica sabendo.
//
// As rotas vêm da especificação pública da Stevo:
//   POST /send/text   { number, text }
//   POST /send/media  { number, type, url, caption }
//   GET  /group/list
// O `number` de um grupo é o identificador dele (termina em @g.us).
//
// Sem as duas variáveis de ambiente o app funciona normalmente, só não envia:
// nada entra na fila, e as telas avisam que o WhatsApp não está configurado.

export type WhatsappGroup = { id: string; name: string };
export type WhatsappMedia = { url: string; type: "image" | "video" | "document" };

const TIMEOUT_MS = 20_000;

function config(): { url: string; key: string } | null {
  const url = process.env.STEVO_API_URL?.trim().replace(/\/+$/, "");
  const key = process.env.STEVO_API_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function whatsappConfigured(): boolean {
  return config() !== null;
}

async function call(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<unknown> {
  const settings = config();
  if (!settings) throw new Error("O WhatsApp não está configurado neste servidor.");
  const response = await fetch(`${settings.url}${path}`, {
    method: init.method,
    headers: { apikey: settings.key, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  let payload: unknown = text;
  try { payload = text ? JSON.parse(text) : null; } catch { /* resposta que não é JSON fica como texto */ }
  if (!response.ok) {
    const detail = typeof payload === "object" && payload && "message" in payload ? String((payload as { message: unknown }).message) : text.slice(0, 200);
    throw new Error(`O serviço de WhatsApp recusou o envio (${response.status}). ${detail}`.trim());
  }
  return payload;
}

export async function sendWhatsappText(groupId: string, text: string): Promise<void> {
  await call("/send/text", { method: "POST", body: { number: groupId, text } });
}

export async function sendWhatsappMedia(groupId: string, media: WhatsappMedia, caption?: string): Promise<void> {
  await call("/send/media", { method: "POST", body: { number: groupId, type: media.type, url: media.url, caption: caption || undefined } });
}

/** A especificação não descreve o formato da resposta de /group/list, então a
 * leitura aceita as formas comuns: uma lista direta ou dentro de `data` /
 * `groups`, com o identificador em JID/jid/id e o nome em Name/name/subject. */
export function parseWhatsappGroups(payload: unknown): WhatsappGroup[] {
  const container = payload as { data?: unknown; groups?: unknown } | unknown[] | null;
  const list = Array.isArray(container) ? container
    : Array.isArray((container as { data?: unknown })?.data) ? (container as { data: unknown[] }).data
    : Array.isArray((container as { groups?: unknown })?.groups) ? (container as { groups: unknown[] }).groups
    : Array.isArray(((container as { data?: { groups?: unknown } })?.data)?.groups) ? ((container as { data: { groups: unknown[] } }).data.groups)
    : [];
  const pick = (item: Record<string, unknown>, keys: string[]) => keys.map((key) => item[key]).find((value) => typeof value === "string" && value.trim()) as string | undefined;
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id = pick(item, ["JID", "jid", "id", "groupJid", "remoteJid"]);
    if (!id) return [];
    return [{ id, name: pick(item, ["Name", "name", "subject", "Subject"]) || id }];
  }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function listWhatsappGroups(): Promise<WhatsappGroup[]> {
  return parseWhatsappGroups(await call("/group/list", { method: "GET" }));
}
