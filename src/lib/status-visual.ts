// Como cada etapa aparece: ícone de progressão + contraste do texto sobre a
// cor escolhida no seletor de cores.
//
// Antes a etapa virava uma bolinha colorida com o texto numa cor diferente,
// então "Revisão" e "Ajuste" eram visualmente idênticos e a cor customizada
// mal aparecia. Agora a tag inteira é pintada com a cor da etapa, e o ícone
// diz em que ponto da esteira a tarefa está sem depender de ler o rótulo.

import type { TaskStatus } from "./types";

// Nome do ícone do lucide-react. A resolução para o componente fica no
// componente React (este arquivo é puro, e por isso testável sem DOM).
export type StatusIconName = "Circle" | "CircleDashed" | "Clock" | "CirclePlay" | "Loader" | "Eye" | "PenLine" | "Send" | "Check" | "CheckCheck" | "TriangleAlert";

export const STATUS_ICON: Record<TaskStatus, StatusIconName> = {
  // Não iniciada — círculo vazio, nada começou.
  rascunho: "Circle",
  aguardando_informacao: "Clock",
  aprovacao_copy: "Send",
  aguardando_captacao: "CircleDashed",
  // Em andamento — a esteira girando.
  pronto_para_criacao: "CirclePlay",
  em_criacao: "Loader",
  revisao: "Eye",
  ajuste: "PenLine",
  // Feita — do "entregue pra aprovar" até o encerramento definitivo.
  para_aprovacao: "Send",
  aprovado: "Check",
  finalizado: "CheckCheck",
  // Problema é o único que quebra a progressão: é um estado de alerta.
  problema: "TriangleAlert",
};

export const OVERDUE_ICON: StatusIconName = "TriangleAlert";

// Luminância relativa (WCAG). Serve pra decidir se o texto sobre a cor da
// etapa sai branco ou quase-preto — sem isso, uma etapa amarela ganharia
// texto branco ilegível.
export function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

// Escolhe entre texto escuro e claro comparando o CONTRASTE REAL dos dois
// contra a cor de fundo, e não por um corte fixo de luminância. Um corte fixo
// erra justamente nos meios-tons: o cinza padrão #aeb5ae fica logo abaixo de
// 0.5 e receberia texto branco, com contraste 2.1 — ilegível. Comparando,
// ganha o escuro, com 7.8.
export const STATUS_TEXT_DARK = "#1c211c";
export const STATUS_TEXT_LIGHT = "#ffffff";

export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function readableTextOn(hex: string): string {
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return STATUS_TEXT_DARK;
  return contrastRatio(hex, STATUS_TEXT_DARK) >= contrastRatio(hex, STATUS_TEXT_LIGHT)
    ? STATUS_TEXT_DARK
    : STATUS_TEXT_LIGHT;
}
