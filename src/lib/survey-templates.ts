import type { SurveyQuestion } from "./types";

export type SurveyTemplate = "blank" | "brand_onboarding" | "brand_diagnosis" | "business_extraction" | "satisfaction";

export const SURVEY_TEMPLATES: { value: SurveyTemplate; label: string; defaultTitle: string; hint: string }[] = [
  { value: "business_extraction", label: "Extrator de negócio", defaultTitle: "Extrator de negócio", hint: "História, estrutura, serviço, alcance e prova — os fatos que montam a apresentação da empresa. 30 perguntas." },
  { value: "brand_diagnosis", label: "Diagnóstico de marca", defaultTitle: "Diagnóstico de marca", hint: "História, produto, público e posicionamento — a matéria-prima de uma apresentação de marca." },
  { value: "brand_onboarding", label: "Onboarding de gestão de marca", defaultTitle: "Onboarding de gestão de marca", hint: "Números, verba, canais, equipe e fluxo de aprovação — o que a operação precisa para rodar." },
  { value: "satisfaction", label: "Satisfação + NPS", defaultTitle: "Pesquisa de satisfação", hint: "Três perguntas curtas para medir a percepção de quem já é cliente." },
  { value: "blank", label: "Em branco", defaultTitle: "", hint: "Comece do zero e escreva suas próprias perguntas." },
];

type Construtor = (
  title: string,
  type?: SurveyQuestion["type"],
  options?: string[],
  required?: boolean,
  description?: string,
) => SurveyQuestion;

// ---------- Diagnóstico de marca ----------
//
// Existe para responder uma pergunta específica: dá para conhecer a empresa sem
// marcar reunião com o representante?
//
// A resposta é sim, mas não perguntando o que normalmente se pergunta. "Qual é
// o seu diferencial?" devolve "qualidade e atendimento" em toda empresa do
// mundo, e aí a reunião vira obrigatória — não porque faltou pergunta, mas
// porque a pergunta não obrigava ninguém a pensar. Então aqui quase nada é
// pedido em adjetivo: pede-se episódio, número, frase literal que alguém disse,
// e o que deu errado. Ninguém consegue responder "o que acontece se a peça
// falhar na mão do cliente" com um lugar-comum.
//
// O `description` de cada pergunta não é enfeite: é o que substitui a pessoa do
// outro lado da mesa dizendo "não, me dá um exemplo concreto". Sem ele, a
// resposta volta rasa e a reunião volta junto.
//
// Vale para indústria e para serviço de propósito. Uma fábrica de conexões
// hidráulicas e uma clínica respondem as mesmas perguntas com conteúdos
// completamente diferentes, e é isso que se quer: o formulário não pode presumir
// que o cliente vende para consumidor final.
export const SECOES_DIAGNOSTICO = [
  "Quem é a empresa",
  "O que vocês vendem",
  "Quem compra",
  "Contra quem vocês competem",
  "Prova",
  "Como a marca deve soar",
  "Material que já existe",
] as const;

function diagnosticoDeMarca(q: Construtor): SurveyQuestion[] {
  const secao = (nome: string, perguntas: SurveyQuestion[]) => perguntas.map((item) => ({ ...item, section: nome }));

  return [
    ...secao("Quem é a empresa", [
      q("Quem fundou a empresa, em que ano, e o que essa pessoa fazia antes disso?", "long_text", undefined, true,
        "O que a pessoa fazia antes costuma explicar o jeito da empresa até hoje."),
      q("Que problema apareceu na frente de vocês e fez a empresa existir?", "long_text", undefined, true,
        "Conte como um caso: o que estava acontecendo no mercado ou na vida de quem fundou."),
      q("O que a empresa fazia no primeiro ano que não faz mais hoje? E o que ela faz hoje que não imaginava fazer?", "long_text", undefined, true,
        "A distância entre esses dois pontos é a história que a apresentação vai contar."),
      q("Descreva a empresa hoje em números: quantas pessoas, onde ficam, o que sai por mês.", "long_text", undefined, true,
        "Ex.: 40 funcionários, uma fábrica em Sorocaba, 12 mil peças/mês, atende 9 estados."),
      q("Houve algum momento em que a empresa quase quebrou, mudou de rumo ou perdeu um cliente grande? O que aconteceu?", "long_text", undefined, false,
        "Não vai para a apresentação sem sua autorização. Serve para entender as decisões que vieram depois."),
      q("Quem manda na comunicação da empresa hoje, e quem dá a palavra final?", "long_text", undefined, true,
        "Nome e cargo. Se forem várias pessoas, diga quem decide quando elas discordam."),
    ]),

    ...secao("O que vocês vendem", [
      q("Explique o que vocês fazem como se estivesse falando com uma criança de 12 anos.", "long_text", undefined, true,
        "Sem termo técnico. Se não der para explicar assim, a apresentação também não vai conseguir."),
      q("Agora explique do jeito técnico, para quem é do ramo.", "long_text", undefined, true,
        "Aqui pode e deve usar norma, medida, especificação, nomenclatura do setor."),
      q("O que exatamente o cliente recebe quando compra? Inclua prazo, forma de entrega e o que vai junto.", "long_text", undefined, true,
        "Peça, lote, projeto, instalação, garantia, assistência — o pacote inteiro."),
      q("Cite três situações reais em que o que vocês vendem está sendo usado neste momento.", "long_text", undefined, true,
        "Onde está instalado, em que tipo de operação, resolvendo o quê."),
      q("O que acontece se o que vocês vendem falhar na mão do cliente?", "long_text", undefined, true,
        "Prejuízo, parada de produção, risco de acidente, retrabalho. É o que mede o tamanho da responsabilidade."),
      q("O que existe dentro do processo de vocês que ninguém de fora imagina?", "long_text", undefined, true,
        "Etapa, teste, cuidado ou pessoa que o cliente não vê e que faz diferença no resultado."),
      q("O que vocês não fazem, mesmo quando pedem?", "long_text", undefined, true,
        "Recusa é posicionamento. O que vocês mandam o cliente procurar em outro lugar?"),
      q("Qual linha, produto ou serviço vocês mais querem vender nos próximos 12 meses?", "long_text", undefined, true,
        "E por quê: margem melhor, capacidade ociosa, mercado novo?"),
    ]),

    ...secao("Quem compra", [
      q("Quem assina a compra e quem usa o produto no dia a dia? São a mesma pessoa?", "long_text", undefined, true,
        "Em muitos negócios quem decide não é quem usa. Descreva os dois papéis."),
      q("Descreva o cliente típico como se descrevesse uma pessoa específica que existe.", "long_text", undefined, true,
        "Tipo de empresa ou pessoa, porte, região, cargo de quem fala com vocês."),
      q("O que acontece na vida do cliente logo antes de ele procurar vocês?", "long_text", undefined, true,
        "O gatilho: quebrou algo, abriu obra, trocou fornecedor, entrou em nova norma."),
      q("De quem ele comprava antes de comprar de vocês?", "long_text", undefined, true,
        "Concorrente, importação, fabricação própria, improviso."),
      q("Qual pergunta o cliente sempre faz antes de fechar?", "short_text", undefined, true,
        "A que aparece em quase toda negociação."),
      q("Qual objeção aparece toda vez, e como vocês respondem hoje?", "long_text", undefined, true,
        "Preço, prazo, desconfiança técnica, medo de trocar de fornecedor."),
      q("Escreva uma frase que um cliente satisfeito realmente disse sobre vocês.", "long_text", undefined, true,
        "Palavras dele, não as suas. Vale um trecho de WhatsApp, e-mail ou ligação."),
      q("E uma reclamação real que vocês já ouviram?", "long_text", undefined, false,
        "Fica entre nós. Serve para a comunicação não prometer o que a operação não entrega."),
      q("Em quais regiões, estados ou mercados vocês vendem hoje, e onde querem crescer?", "long_text", undefined, true),
      q("Como o cliente chega até vocês hoje?", "multiple_choice",
        ["Indicação", "Representante ou vendedor externo", "Distribuidor / revenda", "Instagram", "Google / site", "WhatsApp", "Feira ou evento do setor", "Catálogo / mala direta", "Cliente antigo que volta", "Não sabemos ao certo", "Outro"],
        true),
    ]),

    ...secao("Contra quem vocês competem", [
      q("Cite os concorrentes com quem vocês mais disputam, com nome.", "long_text", undefined, true,
        "Se puder, diga o porte de cada um comparado ao de vocês."),
      q("Quando vocês perdem uma venda para eles, qual é o motivo real?", "long_text", undefined, true,
        "Preço, prazo, marca mais conhecida, relacionamento antigo. Seja honesto: isso não sai da nossa mesa."),
      q("Quando vocês ganham, o que pesou na decisão?", "long_text", undefined, true),
      q("O que um concorrente faz melhor que vocês?", "long_text", undefined, true,
        "Toda empresa tem uma resposta aqui. Quem responde “nada” está adivinhando."),
      q("Se o cliente não comprasse de ninguém do setor, o que ele faria?", "long_text", undefined, true,
        "Adiaria, improvisaria, importaria, faria internamente? Essa é a concorrência que ninguém enxerga."),
    ]),

    ...secao("Prova", [
      q("Qual foi o caso mais difícil que vocês resolveram para um cliente?", "long_text", undefined, true,
        "O problema, o que vocês fizeram e como terminou."),
      q("Quais clientes ou marcas conhecidas vocês atendem e podem citar publicamente?", "long_text", undefined, false,
        "Se houver contrato de sigilo, diga quais não podem aparecer."),
      q("Quais números vocês podem mostrar sem medo?", "long_text", undefined, true,
        "Anos de operação, peças produzidas, clientes ativos, estados atendidos, índice de retrabalho."),
      q("Vocês têm certificação, norma, laudo ou teste que comprove qualidade?", "long_text", undefined, false,
        "ISO, INMETRO, norma do setor, ensaio de pressão, laudo de laboratório."),
      q("O que vocês já publicaram ou apresentaram que deu resultado?", "long_text", undefined, false,
        "Post, catálogo, vídeo, feira, apresentação comercial. E por que você acha que funcionou."),
    ]),

    ...secao("Como a marca deve soar", [
      q("Se a empresa fosse uma pessoa numa reunião, como ela falaria?", "long_text", undefined, true,
        "Direta e técnica? Próxima e informal? Formal e institucional? Descreva com um exemplo de fala."),
      q("Cite três marcas, de qualquer setor, que vocês admiram — e o que admiram em cada uma.", "long_text", undefined, true,
        "Pode ser concorrente, pode ser de outro ramo completamente. O motivo importa mais que o nome."),
      q("E alguma marca que vocês acham que comunica mal? Por quê?", "long_text", undefined, false,
        "Saber o que evitar economiza rodadas de ajuste."),
      q("Existe alguma palavra, promessa ou assunto que a comunicação de vocês nunca deve usar?", "long_text", undefined, true,
        "Termo proibido por norma, comparação que gera processo, promessa que a operação não entrega."),
      q("Daqui a três anos, o que você quer que digam sobre a empresa quando ela não estiver na sala?", "long_text", undefined, true),
    ]),

    ...secao("Material que já existe", [
      q("O que a empresa já tem pronto de material?", "multiple_choice",
        ["Logo em arquivo vetorial", "Manual de marca", "Catálogo de produtos", "Fotos da fábrica ou da operação", "Fotos de produto", "Vídeos", "Apresentação comercial", "Site", "Depoimentos de clientes", "Nada organizado", "Outro"],
        true, "Marque tudo que existe, mesmo que esteja desatualizado."),
      q("Onde esse material está guardado e quem tem acesso?", "long_text", undefined, false,
        "Drive, computador de alguém, agência anterior, e-mail."),
      q("Quem da empresa pode aparecer em foto e vídeo, e quem prefere não aparecer?", "long_text", undefined, true,
        "Nome e cargo. Se ninguém puder, diga também — muda a estratégia inteira."),
      q("Que lugares e processos podemos gravar ou fotografar?", "long_text", undefined, true,
        "Chão de fábrica, montagem, teste, expedição, laboratório, obra de cliente."),
      q("Existe alguma restrição para gravar dentro da empresa?", "long_text", undefined, false,
        "Segredo industrial, exigência de EPI, área de risco, horário limitado."),
      // A última pergunta é a mais importante do formulário. É ela que fecha a
      // lacuna entre "o que perguntamos" e "o que a pessoa sabe e nunca contou".
      q("O que eu não perguntei e você acha que eu preciso saber sobre a empresa?", "long_text", undefined, true,
        "Se houvesse só uma reunião de trinta minutos, o que você faria questão de dizer nela?"),
    ]),
  ];
}

// ---------- Extrator de negócio ----------
//
// Irmão do diagnóstico, com outro alvo. O diagnóstico existe para achar
// posicionamento: pergunta contra quem se compete, como a marca deve soar, o
// que se quer que digam da empresa daqui a três anos. Este aqui existe para
// montar a apresentação institucional, e apresentação institucional se faz de
// fato verificável, não de intenção: quantas pessoas, onde ficam, o que sai por
// mês, o que o cliente recebe, que problema some da vida dele depois.
//
// Trinta perguntas é limite, não meta. Quarenta e cinco campos numa página só
// não são respondidos — são abandonados, ou respondidos em uma linha cada, que
// dá no mesmo. O corte veio de fundir o que se responde junto (estrutura e
// capacidade viram uma pergunta; número e certificado viram outra) e de tirar o
// que era diagnóstico de marca, não extração de negócio.
//
// O `description` continua sendo o que substitui a pessoa do outro lado da mesa
// dizendo "não, me dá um exemplo concreto". Sem ele a resposta volta rasa.
export const SECOES_EXTRATOR = [
  "Origem",
  "A empresa hoje",
  "O que vocês fazem",
  "Onde vocês atendem",
  "Quem contrata e como é o atendimento",
  "O que vocês resolvem",
  "Material e uso da apresentação",
] as const;

function extratorDeNegocio(q: Construtor): SurveyQuestion[] {
  const secao = (nome: string, perguntas: SurveyQuestion[]) => perguntas.map((item) => ({ ...item, section: nome }));

  return [
    ...secao("Origem", [
      q("Quem fundou a empresa, em que ano, e o que essa pessoa fazia antes disso?", "long_text", undefined, true,
        "O que a pessoa fazia antes costuma explicar o jeito da empresa até hoje."),
      q("Como foi o começo: o que fez a empresa existir e como apareceu o primeiro cliente?", "long_text", undefined, true,
        "Conte como um caso — onde funcionava, quantas pessoas eram, qual foi o primeiro trabalho entregue."),
      q("O que a empresa fazia no primeiro ano que não faz mais hoje? E o que ela faz hoje que não imaginava fazer?", "long_text", undefined, true,
        "A distância entre esses dois pontos é a história que a apresentação vai contar."),
      q("Liste os marcos da empresa, com o ano de cada um.", "long_text", undefined, true,
        "Mudança de sede, filial nova, primeira máquina grande, certificação, sócio que entrou ou saiu, serviço novo."),
    ]),

    ...secao("A empresa hoje", [
      q("Nome fantasia, razão social, tempo de mercado e o endereço de cada unidade.", "long_text", undefined, true,
        "Se houver mais de um endereço, diga o que funciona em cada um."),
      q("Quantas pessoas trabalham na empresa hoje e como elas se dividem entre as áreas?", "long_text", undefined, true,
        "Ex.: 40 no total — 22 na produção, 6 no comercial, 4 no administrativo, 8 na instalação."),
      q("Quem são as pessoas-chave e o que cada uma faz de fato?", "long_text", undefined, true,
        "Nome, cargo e a responsabilidade real. Diga também quem dá a palavra final na comunicação."),
      q("Descreva a estrutura de vocês e quanto ela entrega hoje.", "long_text", undefined, true,
        "Galpão, fábrica, escritório, frota, máquinas, laboratório, software — e o volume que sai por mês ou por ano."),
    ]),

    ...secao("O que vocês fazem", [
      q("Explique o que a empresa faz como se estivesse falando com alguém de fora do ramo.", "long_text", undefined, true,
        "Sem termo técnico. Se não der para explicar assim, a apresentação também não vai conseguir."),
      q("Agora explique do jeito técnico, para quem é do ramo.", "long_text", undefined, true,
        "Aqui pode e deve usar norma, medida, especificação e nomenclatura do setor."),
      q("Liste tudo o que vocês vendem e o que está incluído em cada item.", "long_text", undefined, true,
        "Produto, serviço, linha, plano. Em cada um, o que o cliente leva junto e o que é cobrado à parte."),
      q("O que acontece do pedido até a entrega, e o que vem depois dela?", "long_text", undefined, true,
        "Prazo, forma de entrega, instalação, treinamento, garantia, assistência, manutenção."),
      q("O que vocês não fazem, mesmo quando pedem?", "long_text", undefined, true,
        "Recusa é posicionamento. O que vocês mandam o cliente procurar em outro lugar?"),
    ]),

    ...secao("Onde vocês atendem", [
      q("Em quais cidades, estados ou regiões vocês atendem hoje, para que tipo de empresa, e como chegam até lá?", "long_text", undefined, true,
        "Equipe própria, representante, distribuidor, transportadora, atendimento remoto."),
      q("Onde vocês querem crescer nos próximos 12 meses, e qual produto ou serviço deve puxar esse crescimento?", "long_text", undefined, true,
        "E por quê: margem melhor, capacidade ociosa, mercado novo."),
    ]),

    ...secao("Quem contrata e como é o atendimento", [
      q("Quem assina o contrato e quem usa o que vocês entregam no dia a dia? São a mesma pessoa?", "long_text", undefined, true,
        "Em muitos negócios quem decide não é quem usa. Descreva os dois papéis, com cargo."),
      q("O que acontece na vida do cliente logo antes de ele procurar vocês?", "long_text", undefined, true,
        "O gatilho: quebrou algo, abriu obra, trocou de fornecedor, entrou norma nova, cresceu demais."),
      q("Descreva o atendimento passo a passo, do primeiro contato até a entrega.", "long_text", undefined, true,
        "Quem atende, por qual canal, em quanto tempo responde, como sai o orçamento, quem acompanha depois."),
      q("Como o cliente chega até vocês hoje?", "multiple_choice",
        ["Indicação", "Representante ou vendedor externo", "Distribuidor / revenda", "Instagram", "Google / site", "WhatsApp", "Feira ou evento do setor", "Catálogo / mala direta", "Cliente antigo que volta", "Não sabemos ao certo", "Outro"],
        true),
      q("Qual pergunta ou objeção aparece em toda negociação, e como vocês respondem hoje?", "long_text", undefined, true,
        "Preço, prazo, desconfiança técnica, medo de trocar de fornecedor."),
    ]),

    ...secao("O que vocês resolvem", [
      q("Cite três problemas concretos que vocês resolvem — e o que o cliente fazia antes de resolver com vocês.", "long_text", undefined, true,
        "Um problema por parágrafo. O “antes” importa tanto quanto o “depois”."),
      q("Conte o caso mais difícil que vocês já resolveram para um cliente.", "long_text", undefined, true,
        "O problema, o que vocês fizeram e como terminou."),
      q("O que acontece se o que vocês entregam falhar na mão do cliente?", "long_text", undefined, true,
        "Prejuízo, parada de produção, risco de acidente, retrabalho. É o que mede o tamanho da responsabilidade."),
      q("Quais números e comprovações vocês podem mostrar sem medo?", "long_text", undefined, true,
        "Anos de operação, clientes ativos, obras entregues, peças produzidas, estados atendidos — e também certificação, norma, licença, laudo ou registro que vocês tenham."),
      q("Quais clientes ou marcas vocês atendem e podem citar publicamente?", "long_text", undefined, false,
        "Se houver contrato de sigilo, diga quais não podem aparecer."),
      q("Escreva uma frase que um cliente realmente disse sobre vocês.", "long_text", undefined, true,
        "Palavras dele, não as suas. Vale um trecho de WhatsApp, e-mail ou ligação."),
    ]),

    ...secao("Material e uso da apresentação", [
      q("O que a empresa já tem pronto de material?", "multiple_choice",
        ["Logo em arquivo vetorial", "Manual de marca", "Catálogo de produtos", "Fotos da operação", "Fotos de produto", "Vídeos", "Apresentação comercial", "Site", "Depoimentos de clientes", "Nada organizado", "Outro"],
        true, "Marque tudo que existe, mesmo que esteja desatualizado."),
      q("Que lugares, processos e pessoas podemos fotografar e gravar — e o que não pode ser mostrado?", "long_text", undefined, true,
        "Chão de fábrica, montagem, teste, expedição, obra de cliente. Diga quem aparece e quem prefere não aparecer, e se há segredo industrial ou área de risco."),
      q("Para quem essa apresentação vai ser mostrada, e o que precisa acontecer depois que ela terminar?", "long_text", undefined, true,
        "Cliente novo em reunião, licitação, distribuidor, investidor, feira. E o que você quer que a pessoa faça em seguida."),
      // Mesma pergunta que fecha o diagnóstico, e pela mesma razão: é a única
      // que cobre o que o formulário não soube perguntar.
      q("O que eu não perguntei e você acha que eu preciso saber sobre a empresa?", "long_text", undefined, true,
        "Se houvesse só uma reunião de trinta minutos, o que você faria questão de dizer nela?"),
    ]),
  ];
}

// ---------- Onboarding de gestão de marca ----------
// Mora aqui, e não em storage.ts, porque conteúdo de formulário é conteúdo:
// muda com frequência, é lido e revisado por pessoa, e não tem nada a ver com
// como o dado é gravado.
function onboardingDeMarca(q: Construtor): SurveyQuestion[] {
  return [
    q("Quem participa do projeto e qual é o papel de cada pessoa nas decisões da marca?"),
    q("Conte a história da marca e o momento atual do negócio."),
    q("Qual é o propósito da marca? Por que ela existe?"),
    q("Como a empresa ganha dinheiro hoje? Descreva o modelo de negócio e as principais fontes de receita."),
    q("Qual é a faixa de faturamento médio mensal atual?", "single_choice", ["Até R$ 20 mil", "De R$ 20 mil a R$ 50 mil", "De R$ 50 mil a R$ 100 mil", "De R$ 100 mil a R$ 300 mil", "De R$ 300 mil a R$ 1 milhão", "Acima de R$ 1 milhão", "Prefiro informar na reunião"], false),
    q("Qual é o ticket médio e como ele varia entre produtos ou serviços?", "long_text", undefined, false),
    q("Existe sazonalidade no faturamento? Quais são os melhores e os piores períodos do ano?", "long_text", undefined, false),
    q("Quais produtos ou serviços são prioritários hoje? Informe também os mais rentáveis e os que precisam ganhar demanda."),
    q("Quem é o público que a marca precisa alcançar?"),
    q("Quais regiões, cidades ou mercados são prioritários?"),
    q("Como acontece a jornada desde o primeiro contato até a compra?"),
    q("Quais diferenciais fazem o cliente escolher vocês?"),
    q("Quem são os principais concorrentes e referências?"),
    q("Em quais canais a marca está presente atualmente?", "multiple_choice", ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube", "Pinterest", "Google / site", "WhatsApp", "E-mail", "Mídia offline", "Nenhum canal estruturado", "Outro"]),
    q("Quais canais trazem mais resultado hoje e quais precisam ser desenvolvidos?"),
    q("Qual é o papel esperado de cada canal: autoridade, relacionamento, geração de leads, venda, suporte ou comunidade?"),
    q("Quais números atuais precisamos usar como linha de base?", "long_text", undefined, false, "Ex.: seguidores, alcance, engajamento, visitas ao site, leads, vendas e taxa de conversão."),
    q("Quais métricas a empresa acompanha hoje e com que frequência?"),
    q("Quais ferramentas são usadas para medir resultados?", "multiple_choice", ["Instagram Insights", "Meta Business Suite", "Google Analytics", "Google Ads", "Meta Ads", "CRM", "Planilhas", "Relatórios de vendas", "Ainda não medimos", "Outra"], false),
    q("Quanto a empresa investe por mês em marketing e comunicação atualmente?", "single_choice", ["Ainda não investe", "Até R$ 1 mil", "De R$ 1 mil a R$ 3 mil", "De R$ 3 mil a R$ 10 mil", "De R$ 10 mil a R$ 30 mil", "Acima de R$ 30 mil", "Prefiro informar na reunião"], false),
    q("Desse valor, quanto vai para mídia paga e quanto vai para produção, equipe, ferramentas ou fornecedores?", "long_text", undefined, false),
    q("Quais investimentos anteriores em marketing deram resultado? E quais não deram?", "long_text", undefined, false),
    q("A empresa conhece custo por lead, custo de aquisição, retorno sobre investimento ou taxa de conversão? Compartilhe os números disponíveis.", "long_text", undefined, false),
    q("Como funciona hoje o dia a dia da criação de conteúdo, da ideia até a publicação?"),
    q("Com que frequência a marca publica e quais formatos já fazem parte da rotina?", "multiple_choice", ["Reels / vídeos curtos", "Stories", "Carrosséis", "Posts estáticos", "Lives", "Vídeos longos", "Artigos", "E-mail", "Materiais comerciais", "Não existe frequência definida", "Outro"]),
    q("Quem hoje planeja, escreve, aprova, grava, fotografa, edita e publica os conteúdos?"),
    q("Quanto tempo a equipe ou os porta-vozes conseguem reservar para produção e gravações?"),
    q("Qual estrutura de equipe está disponível para o projeto?", "multiple_choice", ["Marketing interno", "Social media", "Designer", "Redator", "Fotógrafo", "Videomaker", "Tráfego pago", "Comercial / vendas", "Atendimento", "Nenhuma equipe dedicada", "Outro"]),
    q("Quais equipamentos estão disponíveis hoje?", "multiple_choice", ["Celular com boa câmera", "Câmera profissional", "Microfone", "Iluminação", "Tripé / estabilizador", "Computador para edição", "Estúdio ou espaço preparado", "Nenhum equipamento", "Outro"], false),
    q("Quais locais, pessoas, produtos e situações podem ser usados nas gravações e sessões de foto?"),
    q("A marca já possui banco de fotos, vídeos, identidade visual, apresentações ou outros materiais? Onde estão armazenados?"),
    q("Quais são hoje os maiores gargalos para produzir e publicar conteúdo com consistência?"),
    q("Como a marca deve ser percebida? Escolha até cinco características."),
    q("Como deve ser o tom de voz? Existe alguma expressão, vocabulário ou jeito de falar característico?"),
    q("Quais objetivos a gestão de marca precisa alcançar nos próximos 12 meses?"),
    q("Quais resultados fariam você considerar este projeto bem-sucedido em 3, 6 e 12 meses?"),
    q("Quais indicadores devem determinar se a estratégia está funcionando?"),
    q("Quais datas, lançamentos, eventos, campanhas ou momentos comerciais já estão previstos?"),
    q("Existe algo que a comunicação nunca deve fazer ou dizer?"),
    q("Há restrições jurídicas, regulatórias, técnicas ou comerciais que precisamos respeitar?", "long_text", undefined, false),
    q("Como funciona a aprovação e quem toma a decisão final?"),
    q("Qual é o prazo ideal para aprovação e por qual canal devemos solicitar retornos?"),
  ];
}

function satisfacao(q: Construtor): SurveyQuestion[] {
  return [
    q("De 0 a 10, o quanto você indicaria a Vizantu para outra empresa?", "nps"),
    q("Qual foi o principal motivo da sua nota?"),
    q("O que podemos melhorar na próxima entrega?", "long_text", undefined, false),
  ];
}

export function questionsForTemplate(template: SurveyTemplate | undefined, newId: () => string): SurveyQuestion[] {
  const q: Construtor = (title, type = "long_text", options, required = true, description) =>
    ({ id: newId(), title, type, required, options, description });
  if (template === "brand_diagnosis") return diagnosticoDeMarca(q);
  if (template === "business_extraction") return extratorDeNegocio(q);
  if (template === "brand_onboarding") return onboardingDeMarca(q);
  if (template === "satisfaction") return satisfacao(q);
  return [];
}
