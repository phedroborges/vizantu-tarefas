// Identidade visual de membros e clientes. Quem tem foto mostra a foto; quem
// não tem cai nas iniciais sobre uma cor. A cor nunca é aleatória: ela é
// derivada do nome, então a mesma pessoa tem sempre a mesma cor em todas as
// telas e entre sessões, sem precisar guardar nada no banco.

// Paleta escolhida pra ser legível com texto branco por cima e pra não
// colidir com o roxo da marca (que fica reservado à interface).
export const AVATAR_COLORS = [
  "#4f6fb5",
  "#2f7d63",
  "#a4552c",
  "#8a4a86",
  "#396c8c",
  "#7a6220",
  "#a1443f",
  "#3f6b46",
] as const;

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  // Primeiro e ÚLTIMO nome — "Ana Paula Souza" vira AS, não AP.
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Hash estável (djb2). Precisa ser determinístico entre servidor e cliente,
// senão o avatar troca de cor na hidratação.
export function colorForName(name: string): string {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) + hash + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

// A cor explícita (escolhida pelo cliente) vence a derivada do nome.
export function avatarColor(name: string, explicit?: string | null): string {
  return isHexColor(explicit) ? explicit : colorForName(name);
}
