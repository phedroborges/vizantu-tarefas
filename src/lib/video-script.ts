// Roteiro de vídeo lido como tabela: cena, fala e lettering.
//
// O roteiro continua sendo TEXTO puro em tasks.description — é o que a IA
// lê e escreve, é o que o cliente copia pra mandar pro produtor e é o que o
// vizantu-planos mostra. Este arquivo não cria um formato novo de
// armazenamento: ele RECONHECE o que o time já escreve ("CENA 1: ABERTURA",
// "Imagem:", "Fala:", "Lettering:") e devolve as mesmas linhas separadas em
// três colunas. Editar continua sendo editar o texto.
//
// Por isso o parser é tolerante e desconfiado ao mesmo tempo. Tolerante nos
// rótulos, porque roteiro antigo escreve "Visual", "Áudio" ou "Letter" no
// lugar dos nomes de hoje. Desconfiado no todo, porque nem todo roteiro é de
// vídeo: um carrossel em SLIDES e um post estático com HEADLINE continuam
// aparecendo como texto, sem uma tabela forçada em cima deles.

export type ScriptField = "cena" | "fala" | "lettering";

export type ScriptScene = {
  /** Número da cena como foi escrito ("1", "7"). */
  number: string;
  /** Nome que veio depois do número ("ABERTURA", "CTA"), quando existe. */
  title: string;
  cena: string;
  fala: string;
  lettering: string;
};

export type VideoScript = {
  /** O que estiver escrito antes da primeira cena — nada se perde. */
  intro: string;
  scenes: ScriptScene[];
};

// "CENA 1", "CENA 1: ABERTURA", "Cena 01 - CTA", "SCENE 2". O \d+ é o que
// separa o cabeçalho de uma cena de um campo "Cena: plano fechado" escrito
// dentro dela.
const SCENE_HEADING = /^\s*(?:cena|scene)\s*0*(\d+)\s*[:.)\-]?\s*(.*)$/i;

const FIELD_LINE = /^\s*([\p{L} ]{2,20})\s*:\s*(.*)$/u;

// Só entra aqui rótulo que não gera dúvida. "Texto" ficou de fora de
// propósito: num carrossel ele é o texto do slide, e aqui viraria fala.
const FIELD_BY_LABEL = new Map<string, ScriptField>([
  ["imagem", "cena"], ["visual", "cena"], ["cena", "cena"], ["video", "cena"],
  ["acao", "cena"], ["plano", "cena"], ["tela", "cena"],
  ["fala", "fala"], ["audio", "fala"], ["narracao", "fala"], ["locucao", "fala"],
  ["off", "fala"], ["voz", "fala"],
  ["lettering", "lettering"], ["letter", "lettering"], ["letreiro", "lettering"],
  ["texto na tela", "lettering"], ["legenda na tela", "lettering"], ["gc", "lettering"],
]);

function normalizeLabel(raw: string): string {
  return raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function emptyScene(number: string, title: string): ScriptScene {
  return { number, title: title.trim(), cena: "", fala: "", lettering: "" };
}

function append(scene: ScriptScene, field: ScriptField, text: string) {
  const value = text.trim();
  if (!value) return;
  scene[field] = scene[field] ? `${scene[field]}\n${value}` : value;
}

// Lê o roteiro e devolve as cenas, ou null quando o texto não é um roteiro de
// vídeo. Nenhuma linha escrita some no caminho: linha sem rótulo entra no
// campo que estiver aberto, e linha antes de qualquer campo entra na coluna
// de cena (é onde o time descreve a imagem).
export function parseVideoScript(text: string | undefined): VideoScript | null {
  if (!text?.trim()) return null;

  const intro: string[] = [];
  const scenes: ScriptScene[] = [];
  let current: ScriptScene | null = null;
  let openField: ScriptField = "cena";

  for (const line of text.split("\n")) {
    const heading = SCENE_HEADING.exec(line);
    if (heading) {
      current = emptyScene(heading[1], heading[2]);
      openField = "cena";
      scenes.push(current);
      continue;
    }

    if (!current) {
      intro.push(line);
      continue;
    }

    const field = FIELD_LINE.exec(line);
    const key = field ? FIELD_BY_LABEL.get(normalizeLabel(field[1])) : undefined;
    if (key) {
      openField = key;
      append(current, key, field![2]);
      continue;
    }

    // Linha solta (continuação de uma fala longa, uma observação, um rótulo
    // que a casa não usa): fica no campo aberto, escrita como veio.
    append(current, openField, line);
  }

  // O gate que impede tabela em cima do que não é vídeo. Uma cena só não é
  // roteiro, e roteiro de vídeo sem nenhuma fala é outra coisa.
  if (scenes.length < 2) return null;
  if (!scenes.some((scene) => scene.fala.trim())) return null;
  if (!scenes.every((scene) => scene.cena.trim() || scene.fala.trim())) return null;

  return { intro: intro.join("\n").trim(), scenes };
}

// Rótulo curto da linha na tabela. O número é o que o time usa pra combinar
// gravação ("refaz a 3"), então ele vem primeiro e o nome da cena embaixo.
export function sceneLabel(scene: ScriptScene): string {
  return `Cena ${scene.number}`;
}
