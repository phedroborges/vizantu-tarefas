// Dados de vitrine. São os mesmos nomes, formatos e etapas que a Vizantu usa
// de verdade — um design system povoado com "Lorem ipsum" e "Item 1" mente
// sobre como o componente se comporta quando o texto é real.

export type Pessoa = { name: string; src: string; papel: string };

// As fotos são ilustrações geradas em public/demo/avatares — elas ocupam
// exatamente o lugar que a foto do membro vai ocupar no sistema.
export const PESSOAS: Record<string, Pessoa> = {
  "Cynthia Almeida": { name: "Cynthia Almeida", src: "/demo/avatares/cynthia.svg", papel: "Redação" },
  "Erika Iorrana": { name: "Erika Iorrana", src: "/demo/avatares/erika.svg", papel: "Design" },
  "Luis Fontes": { name: "Luis Fontes", src: "/demo/avatares/luis.svg", papel: "Edição" },
  "Phedro Borges": { name: "Phedro Borges", src: "/demo/avatares/phedro.svg", papel: "Estratégia" },
  "Marina Reis": { name: "Marina Reis", src: "/demo/avatares/marina.svg", papel: "Atendimento" },
};

export const TIME = Object.values(PESSOAS);

export function pessoa(nome: string): Pessoa {
  return PESSOAS[nome] ?? { name: nome, src: "", papel: "" };
}

export const ETAPAS = [
  { value: "rascunho", label: "Rascunho", tone: "slate", grupo: "Não iniciada" },
  { value: "aguardando_informacao", label: "Aguardando informação", tone: "slate", grupo: "Não iniciada" },
  { value: "aprovacao_copy", label: "Aprovação de texto", tone: "blue", grupo: "Não iniciada" },
  { value: "aguardando_captacao", label: "Aguardando captação", tone: "blue", grupo: "Não iniciada" },
  { value: "pronto_para_criacao", label: "Pronto para criação", tone: "amber", grupo: "Em andamento" },
  { value: "em_criacao", label: "Em criação", tone: "amber", grupo: "Em andamento" },
  { value: "revisao", label: "Revisão", tone: "amber", grupo: "Em andamento" },
  { value: "ajuste", label: "Ajuste", tone: "amber", grupo: "Em andamento" },
  { value: "para_aprovacao", label: "Para aprovação", tone: "green", grupo: "Feita" },
  { value: "aprovado", label: "Aprovado", tone: "green", grupo: "Feita" },
  { value: "finalizado", label: "Finalizado", tone: "green", grupo: "Feita" },
  { value: "problema", label: "Problema", tone: "red", grupo: "Feita" },
] as const;

export const LABEL_ETAPA: Record<string, string> = Object.fromEntries(
  ETAPAS.map((etapa) => [etapa.value, etapa.label]),
);

// Formato define ÍCONE e cor ao mesmo tempo. O ícone é o que se lê primeiro
// numa tabela de 22 linhas — a cor sozinha exige decorar a legenda.
export type FormatoNome = "Reels" | "Carrossel" | "Estático" | "Stories" | "Anúncio";

export const FORMATOS: Record<FormatoNome, { tone: "violet" | "blue" | "green" | "pink" | "amber"; icone: string }> = {
  Reels: { tone: "violet", icone: "video" },
  Carrossel: { tone: "blue", icone: "layers" },
  "Estático": { tone: "green", icone: "image" },
  Stories: { tone: "pink", icone: "smartphone" },
  "Anúncio": { tone: "amber", icone: "megafone" },
};

export type Conteudo = {
  id: string;
  titulo: string;
  formato: FormatoNome;
  pacote: string;
  dono: string;
  prazo: string;
  atraso?: number;
  etapa: string;
  canal: string;
  comentarios: number;
  anexos: number;
  temLink: boolean;
};

export const CONTEUDOS: Conteudo[] = [
  { id: "c1", titulo: "Para quem leva o game a sério", formato: "Carrossel", pacote: "Carrosséis | Educativo", dono: "Cynthia Almeida", prazo: "09 set", etapa: "aprovacao_copy", canal: "Instagram", comentarios: 4, anexos: 2, temLink: false },
  { id: "c2", titulo: "Internet segura para crianças e idosos", formato: "Carrossel", pacote: "Carrosséis | Educativo", dono: "Cynthia Almeida", prazo: "11 set", etapa: "em_criacao", canal: "Instagram", comentarios: 7, anexos: 3, temLink: true },
  { id: "c3", titulo: "O problema pode não ser a sua internet, pode ser o seu Wi-Fi", formato: "Carrossel", pacote: "Carrosséis | Educativo", dono: "Erika Iorrana", prazo: "14 set", etapa: "revisao", canal: "Instagram", comentarios: 2, anexos: 5, temLink: true },
  { id: "c4", titulo: "Casa Conectada na Primavera", formato: "Estático", pacote: "Estáticos | sazonais", dono: "Cynthia Almeida", prazo: "22 set", etapa: "para_aprovacao", canal: "Instagram", comentarios: 1, anexos: 2, temLink: true },
  { id: "c5", titulo: "7 de Setembro: Independência do Brasil", formato: "Estático", pacote: "Estáticos | sazonais", dono: "Luis Fontes", prazo: "07 set", etapa: "aprovado", canal: "Instagram", comentarios: 3, anexos: 1, temLink: true },
  { id: "c6", titulo: "Aproveitando seu colega de serviço", formato: "Reels", pacote: "Captação #1 | Reels", dono: "Cynthia Almeida", prazo: "17 set", etapa: "aguardando_captacao", canal: "Instagram", comentarios: 0, anexos: 0, temLink: false },
  { id: "c7", titulo: "A velocidade que realmente importa", formato: "Reels", pacote: "Captação #2 | Reels", dono: "Erika Iorrana", prazo: "25 set", atraso: 3, etapa: "problema", canal: "TikTok", comentarios: 9, anexos: 4, temLink: true },
];

export type Pacote = {
  id: string;
  nome: string;
  formato: FormatoNome;
  itens: number;
  prontos: number;
  captacao: null | { data: string; local: string; responsavel: string };
  edicao: string;
  criacao: string;
  prazo: string;
};

export const PACOTES: Pacote[] = [
  { id: "p1", nome: "Captação #1 | Reels", formato: "Reels", itens: 6, prontos: 2, captacao: { data: "11 de setembro", local: "Sede TerraNet — Portelândia", responsavel: "Erika Iorrana" }, edicao: "Luis Fontes", criacao: "Cynthia Almeida", prazo: "11 set" },
  { id: "p2", nome: "Captação #2 | Reels", formato: "Reels", itens: 5, prontos: 0, captacao: { data: "18 de setembro", local: "Prédio Savana", responsavel: "Erika Iorrana" }, edicao: "Luis Fontes", criacao: "Cynthia Almeida", prazo: "18 set" },
  { id: "p3", nome: "Carrosséis | Educativo", formato: "Carrossel", itens: 6, prontos: 4, captacao: null, edicao: "—", criacao: "Cynthia Almeida", prazo: "01 set" },
  { id: "p4", nome: "Estáticos | sazonais", formato: "Estático", itens: 5, prontos: 3, captacao: null, edicao: "—", criacao: "Erika Iorrana", prazo: "01 set" },
];
