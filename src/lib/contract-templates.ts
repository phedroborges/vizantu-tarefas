// Os modelos de contrato da casa.
//
// O texto vive aqui, em código, e é COPIADO pra dentro do contrato quando
// alguém cria um (ver a migration de contracts). Melhorar um modelo depois
// nunca mexe em contrato já feito, e muito menos em contrato assinado.
//
// O que muda de cliente pra cliente é {{campo}}. O que dá pra calcular a
// partir desses campos (total, valor por extenso, data final da vigência) NÃO
// é campo: é derivado na hora de renderizar, senão um dado desatualiza o
// outro (ver contract-render.ts).

export type ContractFieldKey = string;

export type ContractField = {
  key: ContractFieldKey;
  label: string;
  hint?: string;
  group: "cliente" | "contrato" | "escopo";
  type?: "texto" | "linhas" | "numero" | "data" | "faixas";
  /** Valor que já vem preenchido, porque quase nunca muda. */
  padrao?: string;
};

// Os cinco primeiros são os que mudam em TODO contrato novo. Ficam juntos e
// primeiro de propósito: no caso comum é só isso que precisa ser digitado.
export const CONTRACT_FIELDS: ContractField[] = [
  { key: "contratante_nome", label: "Nome / Razão social", group: "cliente", hint: "Como está no cartão CNPJ ou no RG" },
  { key: "contratante_documento", label: "CPF / CNPJ", group: "cliente" },
  { key: "contratante_endereco", label: "Endereço completo com CEP", group: "cliente", type: "linhas" },
  { key: "contratante_email", label: "E-mail", group: "cliente", type: "linhas", hint: "Um por linha, se houver mais de um" },
  { key: "forma_pagamento", label: "Forma de pagamento", group: "cliente", padrao: "Faturado/Boleto" },

  { key: "contratante_representante", label: "Representante legal", group: "cliente", hint: "Quem assina pela empresa. Deixe vazio se for pessoa física" },
  { key: "contratante_representante_cpf", label: "CPF do representante", group: "cliente" },

  { key: "marca", label: "Marca ou pessoa atendida", group: "contrato", hint: "Aparece no objeto do contrato. Ex.: a marca Sanfér, a carreira e a marca pessoal de Richard Sanfer" },
  { key: "vigencia_meses", label: "Vigência em meses", group: "contrato", type: "numero", padrao: "6" },
  { key: "escalonamento", label: "Faixas de valor", group: "contrato", type: "faixas", hint: "Só no contrato escalonado. A vigência e o total saem daqui" },
  { key: "vigencia_inicio", label: "Início da vigência", group: "contrato", type: "data" },
  { key: "valor_mensal", label: "Valor mensal em R$", group: "contrato", type: "numero", hint: "Só o número. O extenso e o total saem daqui" },
  { key: "dia_vencimento", label: "Dia do vencimento", group: "contrato", type: "numero", padrao: "25" },
  { key: "data_assinatura", label: "Data de assinatura", group: "contrato", type: "data" },
  { key: "foro", label: "Foro e cidade da assinatura", group: "contrato", padrao: "Mineiros-GO" },

  { key: "qtd_estaticos", label: "Posts estáticos por mês", group: "escopo", type: "numero", padrao: "5" },
  { key: "qtd_carrosseis", label: "Carrosséis por mês", group: "escopo", type: "numero", padrao: "5" },
  { key: "qtd_videos", label: "Vídeos por mês", group: "escopo", type: "numero", padrao: "10" },
  { key: "verba_minima", label: "Verba mínima de tráfego em R$", group: "escopo", type: "numero", padrao: "2000" },
  { key: "emails_vizantu", label: "E-mails da Vizantu para notificação", group: "escopo", type: "linhas", padrao: "contato@vizantu.com.br\nphedro@vizantu.com.br\nerika@vizantu.com.br" },

  { key: "prazo_entrega_marca", label: "Prazo de entrega da marca", group: "escopo", hint: "Só no contrato de criação de marca", padrao: "60 (sessenta) dias corridos" },
  { key: "parcelas", label: "Número de parcelas", group: "escopo", type: "numero", hint: "Só no contrato de criação de marca", padrao: "2" },
];

export const CONTRACT_FIELD_BY_KEY = new Map(CONTRACT_FIELDS.map((field) => [field.key, field]));

// Campos que existem, mas são calculados. Nunca aparecem como caixa de texto.
export const DERIVED_KEYS = [
  "valor_mensal_formatado", "valor_mensal_extenso",
  "valor_total_formatado", "valor_total_extenso",
  "valor_parcela_formatado", "valor_parcela_extenso",
  "verba_minima_formatada", "verba_minima_extenso",
  "vigencia_fim", "primeiro_vencimento", "qtd_total_conteudos",
  "vigencia_inicio_extenso", "vigencia_fim_extenso", "data_assinatura_extenso",
  "contratante_qualificacao", "local_data",
] as const;

export type ContractTemplateId = "gestao_marca" | "criacao_marca" | "branco";

// Dois eixos independentes. QUANDO se paga (antes ou dentro do mês de
// execução) e COMO o valor é montado (mensalidade fixa, mensalidade em
// degraus, ou projeto fechado em parcelas). Um contrato escalonado pode ser
// pré ou pós-pago exatamente como um de mensalidade fixa.
export type PaymentMode = "pre" | "pos";
export type PaymentStructure = "mensal" | "escalonado" | "projeto";

export const PAYMENT_STRUCTURES: { id: PaymentStructure; label: string; descricao: string }[] = [
  { id: "mensal", label: "Mensalidade fixa", descricao: "O mesmo valor todo mês durante a vigência." },
  { id: "escalonado", label: "Escalonado", descricao: "O valor sobe em degraus. A vigência e o total saem das faixas." },
  { id: "projeto", label: "Projeto em parcelas", descricao: "Valor fechado, dividido em parcelas." },
];

export const CONTRACT_TEMPLATES: { id: ContractTemplateId; label: string; descricao: string; temPagamentoMensal: boolean }[] = [
  { id: "gestao_marca", label: "Gestão de marca", descricao: "Estratégia, Instagram, tráfego pago, criação de peças e edição de vídeo. Mensal.", temPagamentoMensal: true },
  { id: "criacao_marca", label: "Criação de marca", descricao: "Diagnóstico, posicionamento, identidade visual e manual de marca. Projeto fechado.", temPagamentoMensal: false },
  { id: "branco", label: "Do zero", descricao: "Um documento em branco, com o cabeçalho das partes e nada mais.", temPagamentoMensal: false },
];

// ---------- Blocos reaproveitados ----------

const ABERTURA = `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE {{titulo_servico}}

**CONTRATADA: VIZANTU LTDA**, inscrita no CNPJ sob o nº 45.724.220/0001-04, atuante sob a marca "Vizantu, Gestão de Marcas", com sede em Mineiros-GO, doravante denominada **CONTRATADA**.

**CONTRATANTE: {{contratante_nome}}**, {{contratante_qualificacao}}, doravante denominada **CONTRATANTE**.

As partes resolvem celebrar o presente Contrato de Prestação de Serviços de {{titulo_servico_frase}}, regido pelas cláusulas seguintes.`;

const FECHAMENTO = `## CLÁUSULA {{n_disposicoes}} – DISPOSIÇÕES GERAIS E FORO

{{n_disposicoes}}.1. Este contrato não cria vínculo empregatício, sociedade, representação comercial ou mandato entre as partes.

{{n_disposicoes}}.2. Alterações somente terão validade se formalizadas por escrito. A eventual tolerância não implica renúncia de direito.

{{n_disposicoes}}.3. As partes reconhecem a validade das assinaturas eletrônicas e dos registros eletrônicos de aprovação e comunicação utilizados na execução contratual.

{{n_disposicoes}}.4. Fica eleito o foro da comarca de {{foro}} para dirimir controvérsias decorrentes deste contrato, com renúncia a qualquer outro, sem prejuízo de tentativa prévia de solução amigável.

:::assinaturas
{{foro}}, {{data_assinatura_extenso}}.

**VIZANTU LTDA**
CNPJ nº 45.724.220/0001-04
CONTRATADA

**{{contratante_nome}}**
{{contratante_documento}}
CONTRATANTE
:::`;

// Cláusulas 4 a 11 do contrato de gestão: valem igual nos dois modelos, só
// muda o número. Por isso a numeração entra por {{n_...}} em vez de vir
// escrita na mão.
const CLAUSULAS_COMUNS = `## CLÁUSULA {{n_fluxo}} – FLUXO DE TRABALHO, APROVAÇÕES E COMUNICAÇÃO

{{n_fluxo}}.1. Planejamentos, entregas, solicitações de ajustes e aprovações serão registrados na Central do Cliente mantida pela CONTRATADA no Vizantu Tarefas. O WhatsApp será utilizado para alinhamentos operacionais, e o e-mail {{emails_vizantu}} para notificações formais.

{{n_fluxo}}.2. A CONTRATANTE terá até 3 (três) dias úteis para aprovar ou solicitar ajustes de forma consolidada. A ausência de resposta suspenderá os prazos afetados pelo mesmo período, sem responsabilidade da CONTRATADA pelo impacto no calendário.

{{n_fluxo}}.3. Em situações urgentes, a aprovação poderá ocorrer por WhatsApp, desde que a mensagem identifique claramente a entrega e seja registrada posteriormente na Central do Cliente.

{{n_fluxo}}.4. Serão realizados alinhamentos semanais pelo WhatsApp e até 1 (uma) reunião estratégica ou de resultados por mês via Google Meet, em data acordada. Reuniões adicionais ou presenciais dependerão de disponibilidade e acordo prévio sobre custos.

## CLÁUSULA {{n_obrigacoes}} – OBRIGAÇÕES DAS PARTES

{{n_obrigacoes}}.1. **Obrigações da CONTRATADA:** executar os serviços com diligência; observar o planejamento aprovado; manter a CONTRATANTE informada; proteger os acessos recebidos; respeitar direitos de terceiros; e corrigir falhas que lhe sejam diretamente imputáveis.

{{n_obrigacoes}}.2. **Obrigações da CONTRATANTE:** fornecer tempestivamente informações, acessos, materiais brutos, autorizações e aprovações; assegurar a veracidade e licitude do material fornecido; pagar a remuneração e a verba de mídia; manter válidos os meios de pagamento das plataformas; e obter autorizações de uso de imagem, voz, marca e obras de terceiros quando aplicável.

{{n_obrigacoes}}.3. Atrasos ou indisponibilidades atribuíveis à CONTRATANTE ou a terceiros prorrogarão automaticamente os prazos afetados, sem ampliar a quantidade de entregas ou gerar obrigação de compensação pela CONTRATADA.

## CLÁUSULA {{n_contas}} – CONTAS, ACESSOS E DADOS

{{n_contas}}.1. Sempre que tecnicamente possível, contas de Instagram, Meta Business, anúncios, pixels e demais ativos digitais serão mantidos em nome ou sob titularidade da CONTRATANTE, que concederá à CONTRATADA apenas os acessos necessários.

{{n_contas}}.2. As partes cumprirão a Lei Geral de Proteção de Dados Pessoais. Quando tratar dados pessoais segundo instruções da CONTRATANTE, a CONTRATADA atuará como operadora, utilizando-os somente para a execução deste contrato e adotando medidas razoáveis de segurança.

{{n_contas}}.3. Incidentes relevantes de segurança serão comunicados à outra parte sem demora injustificada. Encerrado o contrato, os acessos serão revogados e os dados serão devolvidos ou eliminados, ressalvados os registros cuja conservação seja exigida por lei.

## CLÁUSULA {{n_propriedade}} – PROPRIEDADE INTELECTUAL

{{n_propriedade}}.1. Permanecem de titularidade de cada parte suas marcas, métodos, modelos, conhecimentos, materiais e ativos preexistentes.

{{n_propriedade}}.2. Após o pagamento integral dos valores vencidos, a CONTRATANTE receberá licença definitiva, não exclusiva, para utilizar, reproduzir, adaptar e divulgar comercialmente os entregáveis finais aprovados e produzidos especificamente para sua marca, no Brasil e no exterior, em quaisquer mídias existentes na data deste contrato.

{{n_propriedade}}.3. A licença não abrange ferramentas, templates reutilizáveis, métodos internos, arquivos de trabalho não entregues, fontes, imagens, músicas, softwares ou outros elementos de terceiros, que permanecem sujeitos às respectivas licenças.

{{n_propriedade}}.4. A CONTRATADA somente poderá divulgar os entregáveis e resultados em portfólio após sua publicação pela CONTRATANTE e desde que não revele informações confidenciais, salvo manifestação contrária expressa da CONTRATANTE.

## CLÁUSULA {{n_confidencialidade}} – CONFIDENCIALIDADE

{{n_confidencialidade}}.1. Ambas as partes manterão sigilo sobre informações estratégicas, financeiras, comerciais, técnicas, credenciais, dados de clientes e materiais não públicos recebidos em razão do contrato, durante sua vigência e por 3 (três) anos após o término.

{{n_confidencialidade}}.2. Não são confidenciais informações comprovadamente públicas, já conhecidas de forma legítima, recebidas licitamente de terceiro ou cuja divulgação seja exigida por lei ou autoridade competente.

## CLÁUSULA {{n_exclusividade}} – EXCLUSIVIDADE E TERCEIROS

{{n_exclusividade}}.1. Não há exclusividade geral entre as partes. Durante a vigência, a CONTRATANTE evitará contratar outro prestador para executar simultaneamente o mesmo escopo sem alinhamento prévio, a fim de prevenir conflito operacional.

{{n_exclusividade}}.2. A CONTRATADA poderá utilizar colaboradores ou subcontratados sob sua responsabilidade, preservando confidencialidade, segurança e qualidade das entregas.

## CLÁUSULA {{n_rescisao}} – RESCISÃO

{{n_rescisao}}.1. Qualquer parte poderá rescindir imotivadamente o contrato mediante aviso escrito com antecedência mínima de 30 (trinta) dias. Se o aviso não for observado, a parte que rescindir pagará multa equivalente a 50% do valor fixo correspondente ao período de aviso não cumprido, sem prejuízo dos valores já vencidos e dos serviços já executados.

{{n_rescisao}}.2. Em caso de descumprimento relevante, a parte inocente notificará a outra para corrigir a irregularidade em até 5 (cinco) dias úteis. Não havendo correção, poderá rescindir imediatamente o contrato, sem prejuízo de cobrança ou indenização cabível.

{{n_rescisao}}.3. Na rescisão, serão devidos os serviços executados e as despesas previamente aprovadas até a data efetiva do término. Após a quitação, a CONTRATADA entregará os materiais finais concluídos e colaborará com a revogação ou transferência dos acessos.

## CLÁUSULA {{n_responsabilidade}} – RESPONSABILIDADE E CASO FORTUITO

{{n_responsabilidade}}.1. Cada parte responderá por danos diretos comprovadamente causados por sua conduta, observada a legislação aplicável. A CONTRATADA não responde por indisponibilidade, bloqueio, mudança de regras ou falhas das plataformas, nem por conteúdos, produtos, promessas comerciais ou materiais fornecidos pela CONTRATANTE.

{{n_responsabilidade}}.2. Nenhuma parte será considerada inadimplente por atraso causado por evento imprevisível ou inevitável fora de seu controle razoável, devendo comunicar a ocorrência e adotar medidas para reduzir seus efeitos.`;

// ---------- Cláusula de pagamento: o que muda entre pré e pós pago ----------

const PAGAMENTO_MENSAL: Record<PaymentMode, string> = {
  pre: `## CLÁUSULA 3 – REMUNERAÇÃO E PAGAMENTO

3.1. Pelos serviços, a CONTRATANTE pagará à CONTRATADA a mensalidade de **R$ {{valor_mensal_formatado}} ({{valor_mensal_extenso}})**, durante {{vigencia_meses}} meses, totalizando R$ {{valor_total_formatado}} ({{valor_total_extenso}}), por {{forma_pagamento}}.

3.2. O pagamento é antecipado. A primeira mensalidade **{{primeiro_vencimento_frase}}** e as demais no dia {{dia_vencimento}} de cada mês, sempre antes do início do mês de execução a que se referem.

3.3. A execução de cada competência mensal tem início após a confirmação do pagamento correspondente. A CONTRATADA emitirá a documentação fiscal correspondente aos valores recebidos.

3.4. O atraso acarretará multa de 2% sobre o débito, juros de 1% ao mês calculados proporcionalmente e correção monetária. Após notificação e prazo de 3 (três) dias úteis sem regularização, a CONTRATADA poderá suspender os serviços e prazos, sem que isso caracterize inadimplemento seu.`,

  pos: `## CLÁUSULA 3 – REMUNERAÇÃO E PAGAMENTO

3.1. Pelos serviços, a CONTRATANTE pagará à CONTRATADA a mensalidade de **R$ {{valor_mensal_formatado}} ({{valor_mensal_extenso}})**, durante {{vigencia_meses}} meses, totalizando R$ {{valor_total_formatado}} ({{valor_total_extenso}}), por {{forma_pagamento}}, com a primeira mensalidade que **{{primeiro_vencimento_frase}}** e as demais no dia {{dia_vencimento}} dos meses subsequentes.

3.2. A CONTRATADA emitirá a documentação fiscal correspondente aos valores recebidos.

3.3. O atraso acarretará multa de 2% sobre o débito, juros de 1% ao mês calculados proporcionalmente e correção monetária. Após notificação e prazo de 3 (três) dias úteis sem regularização, a CONTRATADA poderá suspender os serviços e prazos, sem que isso caracterize inadimplemento seu.`,
};

// Contrato em degraus. A tabela de faixas vira uma lista dentro da cláusula
// (o {{tabela_escalonamento}} expande em linhas "- do 1º ao 3º mês: ..."), e
// o total sai da soma das faixas, não de um campo digitado. O aviso de que o
// reajuste já está contratado evita a conversa de aditivo lá na frente.
const PAGAMENTO_ESCALONADO: Record<PaymentMode, string> = {
  pre: `## CLÁUSULA 3 – REMUNERAÇÃO E PAGAMENTO

3.1. Pelos serviços, a CONTRATANTE pagará à CONTRATADA mensalidades escalonadas ao longo dos {{vigencia_meses}} meses de vigência, por {{forma_pagamento}}, conforme a tabela abaixo:

{{tabela_escalonamento}}

3.2. O valor total do contrato é de **R$ {{valor_total_formatado}} ({{valor_total_extenso}})**.

3.3. O pagamento é antecipado. A primeira mensalidade **{{primeiro_vencimento_frase}}** e as demais no dia {{dia_vencimento}} de cada mês, sempre antes do início do mês de execução a que se referem. A execução de cada competência mensal tem início após a confirmação do pagamento correspondente.

3.4. Os valores da tabela acima já estão contratados e reajustam automaticamente nas datas indicadas, sem necessidade de aditivo. A CONTRATADA emitirá a documentação fiscal correspondente aos valores recebidos.

3.5. O atraso acarretará multa de 2% sobre o débito, juros de 1% ao mês calculados proporcionalmente e correção monetária. Após notificação e prazo de 3 (três) dias úteis sem regularização, a CONTRATADA poderá suspender os serviços e prazos, sem que isso caracterize inadimplemento seu.`,

  pos: `## CLÁUSULA 3 – REMUNERAÇÃO E PAGAMENTO

3.1. Pelos serviços, a CONTRATANTE pagará à CONTRATADA mensalidades escalonadas ao longo dos {{vigencia_meses}} meses de vigência, por {{forma_pagamento}}, conforme a tabela abaixo:

{{tabela_escalonamento}}

3.2. O valor total do contrato é de **R$ {{valor_total_formatado}} ({{valor_total_extenso}})**.

3.3. A primeira mensalidade **{{primeiro_vencimento_frase}}** e as demais no dia {{dia_vencimento}} dos meses subsequentes.

3.4. Os valores da tabela acima já estão contratados e reajustam automaticamente nas datas indicadas, sem necessidade de aditivo. A CONTRATADA emitirá a documentação fiscal correspondente aos valores recebidos.

3.5. O atraso acarretará multa de 2% sobre o débito, juros de 1% ao mês calculados proporcionalmente e correção monetária. Após notificação e prazo de 3 (três) dias úteis sem regularização, a CONTRATADA poderá suspender os serviços e prazos, sem que isso caracterize inadimplemento seu.`,
};

const PAGAMENTO_PROJETO: Record<PaymentMode, string> = {
  pre: `## CLÁUSULA 3 – REMUNERAÇÃO E PAGAMENTO

3.1. Pelo projeto, a CONTRATANTE pagará à CONTRATADA o valor total de **R$ {{valor_total_formatado}} ({{valor_total_extenso}})**, em {{parcelas}} parcelas de R$ {{valor_parcela_formatado}} ({{valor_parcela_extenso}}), por {{forma_pagamento}}.

3.2. O pagamento é antecipado. A primeira parcela **{{primeiro_vencimento_frase}}** e as demais no dia {{dia_vencimento}} dos meses seguintes. O início dos trabalhos ocorre após a confirmação da primeira parcela.

3.3. A CONTRATADA emitirá a documentação fiscal correspondente aos valores recebidos.

3.4. O atraso acarretará multa de 2% sobre o débito, juros de 1% ao mês calculados proporcionalmente e correção monetária. Após notificação e prazo de 3 (três) dias úteis sem regularização, a CONTRATADA poderá suspender os serviços e prazos, sem que isso caracterize inadimplemento seu.`,

  pos: `## CLÁUSULA 3 – REMUNERAÇÃO E PAGAMENTO

3.1. Pelo projeto, a CONTRATANTE pagará à CONTRATADA o valor total de **R$ {{valor_total_formatado}} ({{valor_total_extenso}})**, em {{parcelas}} parcelas de R$ {{valor_parcela_formatado}} ({{valor_parcela_extenso}}), por {{forma_pagamento}}, com a primeira parcela que **{{primeiro_vencimento_frase}}** e as demais no dia {{dia_vencimento}} dos meses subsequentes.

3.2. A entrega final dos arquivos abertos ocorre após a quitação integral do projeto. A CONTRATADA emitirá a documentação fiscal correspondente aos valores recebidos.

3.3. O atraso acarretará multa de 2% sobre o débito, juros de 1% ao mês calculados proporcionalmente e correção monetária. Após notificação e prazo de 3 (três) dias úteis sem regularização, a CONTRATADA poderá suspender os serviços e prazos, sem que isso caracterize inadimplemento seu.`,
};

// ---------- Escopo de cada modelo (cláusulas 1 e 2) ----------

const ESCOPO_GESTAO = `## CLÁUSULA 1 – OBJETO E ESCOPO

1.1. O objeto deste contrato é a prestação, pela CONTRATADA, de serviços de gestão de marca, posicionamento e marketing digital de {{marca}}, limitados às seguintes frentes:

**1.1.1. Estratégia de marca e marketing:**

- diagnóstico de posicionamento, público, concorrência, comunicação e presença digital;
- definição de posicionamento, narrativa, tom de voz, pilares de conteúdo e direcionamento criativo;
- elaboração e atualização do plano estratégico da marca e da presença digital, com cronograma de ações e campanhas durante a vigência;
- reuniões de acompanhamento e recomendações de otimização.

**1.1.2. Gerenciamento do Instagram (social media):**

- planejamento mensal de pauta e calendário editorial;
- produção mensal de {{qtd_estaticos}} posts estáticos, {{qtd_carrosseis}} carrosséis e {{qtd_videos}} vídeos, totalizando {{qtd_total_conteudos}} conteúdos planejados;
- elaboração de roteiros, legendas, chamadas para ação e direcionamentos de publicação;
- programação ou publicação dos conteúdos, desde que a CONTRATANTE forneça os acessos necessários;
- avaliação e publicação de conteúdos rápidos, registros do momento ou ideias próprias enviados espontaneamente pela CONTRATANTE, como materiais complementares ao calendário, desde que estejam alinhados à estratégia, demandem apenas tratamento simples e haja viabilidade operacional. Esses conteúdos não substituem automaticamente as entregas planejadas nem caracterizam obrigação ilimitada de produção;
- acompanhamento dos principais indicadores do perfil e apresentação de relatório mensal.

**1.1.3. Gestão de tráfego pago:**

- planejamento, configuração, acompanhamento e otimização de campanhas na plataforma Meta Ads;
- configuração de públicos, eventos e rastreamento tecnicamente disponíveis;
- análise de resultados e relatório mensal de desempenho;
- a gestão de investimento mensal é de no mínimo R$ {{verba_minima_formatada}} ({{verba_minima_extenso}}) por mês. A verba será paga diretamente pela CONTRATANTE à plataforma e não integra a remuneração da CONTRATADA.

**1.1.4. Criação de peças e criativos:**

- direção criativa e criação das peças gráficas necessárias aos conteúdos e anúncios previstos no planejamento mensal;
- adaptação das peças aos formatos definidos para Instagram e Meta Ads;
- observância da identidade visual e das diretrizes estratégicas aprovadas.

**1.1.5. Edição de vídeo:**

- edição de {{qtd_videos}} vídeos mensais e dos criativos de vídeo previstos nas campanhas aprovadas;
- cortes, montagem, legendas simples, trilha licenciada ou disponibilizada pelas plataformas, identidade visual e exportação em formato adequado ao canal;
- o material bruto deverá ser entregue pela CONTRATANTE organizado, com qualidade técnica suficiente e dentro dos prazos do calendário.

1.2. Não estão incluídos: captação presencial de foto ou vídeo, produção audiovisual externa, contratação de influenciadores, atendimento individual a seguidores, desenvolvimento de sites ou páginas, hospedagem, aquisição de ferramentas, verba de anúncios ou serviços não descritos nesta cláusula.

1.3. Cada entrega inclui até 2 (duas) rodadas de ajustes, desde que solicitadas de forma consolidada e sem alteração do briefing aprovado. Mudanças de estratégia, refações decorrentes de novo direcionamento, captações realizadas pela CONTRATADA e demandas complexas excedentes serão objeto de orçamento e aprovação prévia.

1.4. A CONTRATADA possui autonomia técnica e operacional, inexistindo garantia de número específico de vendas, seguidores, alcance, faturamento ou retorno sobre investimento, pois os resultados dependem também de fatores de mercado, oferta, preço, conteúdo fornecido, verba e decisões da CONTRATANTE e das plataformas utilizadas.

## CLÁUSULA 2 – VIGÊNCIA E CRONOGRAMA

2.1. O contrato vigorará por {{vigencia_meses}} meses, de **{{vigencia_inicio_extenso}} a {{vigencia_fim_extenso}}**.

2.2. A CONTRATADA trabalhará com planejamento antecipado de 1 (um) mês. Para lançamentos, eventos ou ações de grande porte previamente informados, o planejamento deverá começar, preferencialmente, com antecedência mínima de 3 (três) meses.

2.3. O ciclo mensal de planejamento e produção observará, como regra, as seguintes etapas:

- **do dia 1º ao dia 7:** coleta de informações, definição de prioridades, esclarecimento de dúvidas e recebimento, pela CONTRATADA, dos materiais e direcionamentos necessários;
- **do dia 7 ao dia 14:** elaboração do planejamento e realização de reunião para apresentação e aprovação do plano do mês seguinte;
- **do dia 14 ao dia 21:** envio consolidado de feedbacks pela CONTRATANTE, realização dos ajustes e aprovação final;
- **do dia 21 ao dia 1º do mês seguinte:** criação dos roteiros, peças, carrosséis, vídeos e criativos aprovados.

2.4. O calendário poderá ser ajustado por acordo entre as partes ou em razão de feriados, eventos supervenientes, atrasos de aprovação ou entrega tardia de materiais. A primeira competência poderá seguir calendário de implantação específico, por se tratar do início da operação.

2.5. A renovação dependerá de acordo escrito entre as partes, inclusive quanto a valores, entregas e prazos.`;

const ESCOPO_CRIACAO = `## CLÁUSULA 1 – OBJETO E ESCOPO

1.1. O objeto deste contrato é a prestação, pela CONTRATADA, de serviços de criação de marca para {{marca}}, limitados às seguintes frentes:

**1.1.1. Diagnóstico e estratégia:**

- imersão com a CONTRATANTE sobre negócio, público, concorrência e objetivos;
- definição de posicionamento, proposta de valor, narrativa e tom de voz;
- definição dos atributos e do território visual da marca.

**1.1.2. Identidade visual:**

- criação do símbolo e da assinatura visual da marca, em até 3 (três) rotas de conceito para escolha de uma;
- definição de paleta de cores, tipografia e elementos de apoio;
- construção das versões e reduções da marca para uso em diferentes tamanhos e fundos.

**1.1.3. Manual de marca:**

- manual com as regras de uso, versões, cores, tipografia, malha construtiva, usos indevidos e exemplos de aplicação;
- entrega em PDF, para consulta e para repasse a terceiros que venham a produzir materiais da marca.

**1.1.4. Aplicações:**

- aplicação da marca em até 5 (cinco) peças definidas em comum acordo, como cartão, assinatura de e-mail, papelaria, fachada, uniforme, embalagem ou perfil de redes sociais;
- entrega dos arquivos finais em formatos abertos e fechados, prontos para produção gráfica e digital.

1.2. Não estão incluídos: registro da marca no INPI e respectivas taxas, pesquisa de anterioridade, produção gráfica, fotografia, produção audiovisual, desenvolvimento de sites ou páginas, gestão de redes sociais, tráfego pago ou serviços não descritos nesta cláusula. O registro no INPI pode ser orientado pela CONTRATADA e conduzido por profissional habilitado, mediante contratação à parte.

1.3. Cada etapa inclui até 2 (duas) rodadas de ajustes sobre a rota escolhida, desde que solicitadas de forma consolidada e sem alteração do briefing aprovado. A troca de rota depois de aprovada, mudanças de direcionamento e demandas excedentes serão objeto de orçamento e aprovação prévia.

1.4. A CONTRATADA possui autonomia técnica e criativa. A aprovação de cada etapa pela CONTRATANTE é condição para o início da etapa seguinte.

## CLÁUSULA 2 – VIGÊNCIA E CRONOGRAMA

2.1. O prazo de execução é de {{prazo_entrega_marca}}, contados do início dos trabalhos, previsto para **{{vigencia_inicio_extenso}}**.

2.2. O cronograma observará, como regra, as seguintes etapas: diagnóstico e estratégia, apresentação das rotas de conceito, desenvolvimento da rota escolhida, manual de marca e aplicações.

2.3. Os prazos correm a partir do recebimento das informações e aprovações da CONTRATANTE. A ausência de resposta suspende o cronograma pelo mesmo período, sem responsabilidade da CONTRATADA.

2.4. O prazo poderá ser ajustado por acordo entre as partes ou em razão de feriados, eventos supervenientes ou atrasos de aprovação.`;

// ---------- Montagem ----------

// A numeração das cláusulas comuns depende de quantas cláusulas o escopo do
// modelo usou. Resolver isso aqui evita o erro clássico de contrato com duas
// cláusulas 7 depois de alguém inserir uma no meio.
function numerarClausulas(texto: string, primeira: number): string {
  const ordem = ["n_fluxo", "n_obrigacoes", "n_contas", "n_propriedade", "n_confidencialidade", "n_exclusividade", "n_rescisao", "n_responsabilidade", "n_disposicoes"];
  return ordem.reduce((atual, chave, indice) => atual.replaceAll(`{{${chave}}}`, String(primeira + indice)), texto);
}

// A cláusula 3 sozinha. Fica separada porque ela é a única que muda quando
// alguém troca a estrutura de pagamento de um contrato que já existe — e aí a
// troca precisa mexer só nela, preservando qualquer edição feita no resto do
// documento.
export function buildPaymentClause(templateId: ContractTemplateId, structure: PaymentStructure, mode: PaymentMode): string {
  if (structure === "escalonado") return PAGAMENTO_ESCALONADO[mode];
  if (structure === "projeto") return PAGAMENTO_PROJETO[mode];
  // Mensalidade fixa num contrato de projeto não existe: o modelo de criação
  // de marca sempre fecha em parcelas.
  return templateId === "criacao_marca" ? PAGAMENTO_PROJETO[mode] : PAGAMENTO_MENSAL[mode];
}

// Troca a cláusula 3 de um contrato JÁ existente sem tocar em mais nada. O
// recorte vai do cabeçalho da 3 até o começo da 4, que é o único par de
// âncoras que sobrevive a alguém ter reescrito o miolo da cláusula.
export function replacePaymentClause(body: string, novaClausula: string): string {
  const inicio = body.search(/^## CLÁUSULA 3\b/m);
  if (inicio < 0) return body;
  const resto = body.slice(inicio);
  const fim = resto.search(/^## CLÁUSULA 4\b/m);
  return fim < 0
    ? body.slice(0, inicio) + novaClausula
    : body.slice(0, inicio) + novaClausula + "\n\n" + resto.slice(fim);
}

export function defaultStructure(templateId: ContractTemplateId): PaymentStructure {
  return templateId === "criacao_marca" ? "projeto" : "mensal";
}

// Monta o texto completo do modelo, já com a cláusula de pagamento certa e a
// numeração fechada. É este texto que é copiado pro contrato.
export function buildContractBody(templateId: ContractTemplateId, paymentMode: PaymentMode, structure?: PaymentStructure): string {
  if (templateId === "branco") {
    return `${ABERTURA}\n\n## CLÁUSULA 1 – OBJETO\n\n1.1. \n\n${numerarClausulas(FECHAMENTO, 2)}`
      .replaceAll("{{titulo_servico}}", "SERVIÇOS")
      .replaceAll("{{titulo_servico_frase}}", "serviços");
  }

  const gestao = templateId === "gestao_marca";
  const escopo = gestao ? ESCOPO_GESTAO : ESCOPO_CRIACAO;
  const pagamento = buildPaymentClause(templateId, structure ?? defaultStructure(templateId), paymentMode);
  const corpo = [ABERTURA, escopo, pagamento, CLAUSULAS_COMUNS, FECHAMENTO].join("\n\n");

  return numerarClausulas(corpo, 4)
    .replaceAll("{{titulo_servico}}", gestao ? "GESTÃO DE MARCA" : "CRIAÇÃO DE MARCA")
    .replaceAll("{{titulo_servico_frase}}", gestao ? "Gestão de Marca e Marketing Digital" : "Criação de Marca");
}
