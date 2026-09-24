// O guia do cliente — a resposta a um problema concreto: quem faz a reunião é
// o dono, e tudo que ele descobre lá (quem é o cliente, o que ele quer, no que
// ele é enjoado) morria na reunião. A equipe recebia a tarefa sem nada disso.
//
// A ficha antiga tinha quatro caixas genéricas e treze dos catorze clientes
// estavam vazios. A diferença aqui é que cada campo é uma PERGUNTA, não um
// substantivo: ninguém sabe o que escrever em "Observações", mas todo mundo
// sabe responder "no que ele é enjoado?".
//
// Este arquivo é a fonte única: a tela monta os blocos a partir dele e o
// prompt da IA descreve os campos a partir dele. Mexer aqui muda os dois.

import type { ProjectProfile } from "./types";

export type GuideFieldKind = "curto" | "longo" | "escolha";

export type GuideField = {
  key: GuideFieldKey;
  // O que aparece na tela e o que a IA recebe como instrução. É pergunta
  // mesmo, com interrogação, porque campo que pergunta é campo que é
  // respondido.
  pergunta: string;
  // Só na tela, embaixo da pergunta. Existe pra tirar a dúvida de escopo
  // ("isso é sobre ele ou sobre a empresa dele?").
  ajuda: string;
  kind: GuideFieldKind;
  opcoes?: string[];
};

export type GuideBlock = {
  key: string;
  titulo: string;
  // Por que este bloco existe. A equipe lê isso antes de ler as respostas.
  resumo: string;
  campos: GuideField[];
};

export const CLIENT_GUIDE_BLOCKS: GuideBlock[] = [
  {
    key: "quem",
    titulo: "Quem é",
    resumo: "O básico que todo mundo do time precisa saber antes de escrever a primeira linha para esse cliente.",
    campos: [
      { key: "quemEh", pergunta: "Quem é o cliente?", ajuda: "A pessoa, não a empresa. Nome, idade aproximada, o que ela faz no dia a dia.", kind: "longo" },
      { key: "deOndeVeio", pergunta: "De onde ele veio?", ajuda: "Indicação, anúncio, evento, Instagram. Quem trouxe e por qual caminho.", kind: "curto" },
      { key: "oQueFaz", pergunta: "O que a empresa dele faz?", ajuda: "Em uma frase que qualquer pessoa do time entenda sem conhecer o setor.", kind: "longo" },
      { key: "produtoServico", pergunta: "O que ele vende?", ajuda: "Produto ou serviço, faixa de preço, o que dá mais lucro e o que ele mais quer vender.", kind: "longo" },
      { key: "historiaDele", pergunta: "Como foi a história dele?", ajuda: "Como o negócio começou, o que deu errado no caminho, onde ele chegou. É daqui que sai storytelling.", kind: "longo" },
      { key: "comoTrabalha", pergunta: "Como ele trabalha?", ajuda: "Rotina, horários, quem decide, como ele responde, se some no fim de semana.", kind: "longo" },
    ],
  },
  {
    key: "quer",
    titulo: "O que ele quer",
    resumo: "O destino. Se a peça não caminha para cá, ela está bonita e errada.",
    campos: [
      { key: "desejo", pergunta: "Qual é o desejo dele?", ajuda: "O que ele quer que aconteça de verdade, mesmo que não tenha dito com essas palavras.", kind: "longo" },
      { key: "porQueNosProcurou", pergunta: "Por que ele nos procurou?", ajuda: "O que estava doendo no momento em que ele decidiu contratar.", kind: "longo" },
    ],
  },
  {
    key: "lidar",
    titulo: "Como lidar com ele",
    resumo: "O que evita retrabalho e conversa difícil. Leia antes de mandar qualquer coisa para aprovação.",
    campos: [
      { key: "perfilDoCliente", pergunta: "Que tipo de cliente ele é para nós?", ajuda: "Para uso interno. Parceiro, exigente, ausente, apressado, indeciso. Seja honesto.", kind: "longo" },
      { key: "pontosDePrecisao", pergunta: "No que ele é enjoado?", ajuda: "O detalhe que ele repara e devolve. Cor, foto, palavra, logo, jeito de falar.", kind: "longo" },
      { key: "problemasAnteriores", pergunta: "O que deu errado com quem atendeu antes?", ajuda: "Para não repetirmos. Atraso, sumiço, peça genérica, promessa não cumprida.", kind: "longo" },
    ],
  },
  {
    key: "trabalho",
    titulo: "Como o trabalho é feito",
    resumo: "A parte prática. É o que o diretor criativo abre quando vai produzir.",
    campos: [
      { key: "estrategia", pergunta: "Qual é a estratégia?", ajuda: "O caminho escolhido e o porquê. O que a gente está construindo nos próximos meses.", kind: "longo" },
      { key: "comoExecutar", pergunta: "Como o trabalho precisa ser feito?", ajuda: "Ritmo, quantidade, quem grava, quem edita, o que passa por aprovação e o que não passa.", kind: "longo" },
      { key: "temasSugeridos", pergunta: "Que temas funcionam para ele?", ajuda: "Um por linha. E, se souber, quais já foram testados e não funcionaram.", kind: "longo" },
      { key: "formatosSugeridos", pergunta: "Que formatos funcionam para ele?", ajuda: "Reels, carrossel, estático, story. Diga também o que ele se recusa a fazer.", kind: "longo" },
      { key: "referencias", pergunta: "Em que a gente se inspira?", ajuda: "Links, perfis, campanhas. O que ele mandou e o que a gente escolheu.", kind: "longo" },
    ],
  },
  {
    key: "pessoal",
    titulo: "Pessoal",
    resumo: "Para lembrar dele em data importante. Custa pouco e o cliente nunca esquece.",
    campos: [
      { key: "tamanhoCamiseta", pergunta: "Tamanho de camiseta", ajuda: "Para brinde e presente.", kind: "escolha", opcoes: ["PP", "P", "M", "G", "GG", "XG"] },
      { key: "gostosPessoais", pergunta: "O que ele gosta?", ajuda: "Time, bebida, comida, viagem, pet, aniversário. O que serve de presente ou de assunto.", kind: "longo" },
    ],
  },
];

export type GuideFieldKey =
  | "quemEh" | "deOndeVeio" | "oQueFaz" | "produtoServico" | "historiaDele" | "comoTrabalha"
  | "desejo" | "porQueNosProcurou"
  | "perfilDoCliente" | "pontosDePrecisao" | "problemasAnteriores"
  | "estrategia" | "comoExecutar" | "temasSugeridos" | "formatosSugeridos" | "referencias"
  | "tamanhoCamiseta" | "gostosPessoais";

export const CLIENT_GUIDE_FIELDS: GuideField[] = CLIENT_GUIDE_BLOCKS.flatMap((bloco) => bloco.campos);

export const CLIENT_GUIDE_FIELD_KEYS: GuideFieldKey[] = CLIENT_GUIDE_FIELDS.map((campo) => campo.key);

export function isGuideFieldKey(value: string): value is GuideFieldKey {
  return (CLIENT_GUIDE_FIELD_KEYS as string[]).includes(value);
}

// Quanto do guia está preenchido. Serve pra listar clientes descobertos sem
// alguém precisar abrir um por um — o vazio precisa ser visível, senão ele
// continua vazio (foi exatamente o que aconteceu com a ficha antiga).
export function guideCompletion(profile: Partial<ProjectProfile> | undefined) {
  const porBloco = CLIENT_GUIDE_BLOCKS.map((bloco) => {
    const preenchidos = bloco.campos.filter((campo) => Boolean(profile?.[campo.key]?.trim())).length;
    return { key: bloco.key, titulo: bloco.titulo, preenchidos, total: bloco.campos.length };
  });
  const preenchidos = porBloco.reduce((soma, bloco) => soma + bloco.preenchidos, 0);
  const total = CLIENT_GUIDE_FIELDS.length;
  return { preenchidos, total, percentual: total ? Math.round((preenchidos / total) * 100) : 0, porBloco };
}
