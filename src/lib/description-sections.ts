// Padrão de descrição dos itens de plano: as MESMAS seções pra todo item,
// sempre — não é markdown que alguém precisa lembrar de digitar. A UI mostra
// um bloco por seção; aqui só fica a conversão entre esse formato estruturado
// e o texto salvo em tasks.description (que precisa continuar sendo texto
// puro, porque a IA lê/escreve nele e o vizantu-planos mostra pro cliente).

export const DESCRIPTION_SECTIONS = [
  { key: "direcionamento", label: "Direcionamento", placeholder: "O que precisa acontecer nesse conteúdo, o contexto, o que gravar/fazer" },
  { key: "roteiro", label: "Roteiro", placeholder: "Cena, fala, lettering — o roteiro em si" },
  { key: "legenda", label: "Legenda", placeholder: "Texto complementar da publicação e CTA" },
  { key: "referencia", label: "Referência", placeholder: "Links ou descrição do que serve de referência" },
] as const;

export type DescriptionSectionKey = (typeof DESCRIPTION_SECTIONS)[number]["key"];
export type DescriptionSections = Record<DescriptionSectionKey, string> & { livre: string };

const LABEL_TO_KEY = new Map<string, DescriptionSectionKey>(
  DESCRIPTION_SECTIONS.map((s) => [s.label.toLowerCase(), s.key]),
);

// Aceita variações antigas sem misturar conteúdos de seções diferentes.
const ALIASES: Record<string, DescriptionSectionKey> = {
  ideia: "roteiro",
  referencias: "referencia",
  "referência": "referencia",
};

function normalizeHeading(raw: string): DescriptionSectionKey | null {
  const clean = raw.trim().toLowerCase().replace(/:$/, "");
  return LABEL_TO_KEY.get(clean) ?? ALIASES[clean] ?? null;
}

export function emptySections(): DescriptionSections {
  return { direcionamento: "", roteiro: "", legenda: "", referencia: "", livre: "" };
}

// Lê o texto salvo e separa nas seções conhecidas. Qualquer coisa escrita
// antes da primeira seção (ou num item antigo, sem seção nenhuma) cai em
// "livre" — nada é descartado.
export function parseDescription(text: string | undefined): DescriptionSections {
  const result = emptySections();
  if (!text?.trim()) return result;

  const lines = text.split("\n");
  let current: DescriptionSectionKey | "livre" = "livre";
  const buffers: Record<string, string[]> = { direcionamento: [], roteiro: [], legenda: [], referencia: [], livre: [] };

  for (const line of lines) {
    const heading = /^\s*\*\*(.+?)\*\*\s*$/.exec(line);
    const key = heading ? normalizeHeading(heading[1]) : null;
    if (key) {
      current = key;
      continue;
    }
    buffers[current].push(line);
  }

  for (const key of Object.keys(buffers)) {
    result[key as keyof DescriptionSections] = buffers[key].join("\n").trim();
  }
  return result;
}

// Volta pro formato de texto salvo no banco. Seção vazia não vira cabeçalho
// órfão — o cliente não vê "Roteiro" sem roteiro embaixo.
export function serializeDescription(sections: DescriptionSections): string {
  const parts: string[] = [];
  if (sections.livre.trim()) parts.push(sections.livre.trim());
  for (const section of DESCRIPTION_SECTIONS) {
    const value = sections[section.key]?.trim();
    if (value) parts.push(`**${section.label}**\n${value}`);
  }
  return parts.join("\n\n");
}
