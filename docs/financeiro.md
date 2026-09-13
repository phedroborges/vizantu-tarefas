# Financeiro da Vizantu

O módulo `/financeiro` é exclusivo do cargo `dono`. Menu, guarda da página e API verificam a permissão. As tabelas não concedem acesso direto a `anon` ou `authenticated`: o servidor usa `service_role` depois de autenticar o dono. RPCs usam SECURITY INVOKER e EXECUTE exclusivo do servidor.

## Colocar em operação

1. As migrations `20260913132158_finance_dashboard.sql` e `20260913160000_finance_notifications.sql` **já foram aplicadas** no banco de produção. A ordem importa em qualquer nova instalação: banco primeiro, código depois. O controle de acesso ao portal consulta `finance_project_blocks`, e subir o código sem a tabela derruba o acesso de todo cliente ao plano.
2. Confirmar as variáveis de servidor já usadas pelo app: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, além da configuração de autenticação existente. Nunca publicar a chave de serviço em variável NEXT_PUBLIC.
3. Em Financeiro → Configurações, informar saldo inicial, data-base e margem-alvo. A alíquota já nasce em **6% sobre o faturamento**, informada pela Vizantu; é alíquota efetiva declarada, sem apuração de Simples nem emissão fiscal. Deixar em branco volta a exibir imposto e margem como indisponíveis.
4. Confirmar a regra de desconto e se os prazos são corridos ou úteis. Padrão inicial: atraso **e** problema confirmado; 1 dia para avulsa, 3 dias para pacote, dias corridos. Dias úteis significam segunda a sexta, sem cadastro de feriados.
5. Conferir contratos importados e cadastrar despesas, recebimentos anteriores e custos de ferramentas/operacionais. Dados não cadastrados não são inferidos.

O schema foi exercitado primeiro em Postgres embarcado (PGlite) e depois no banco real, em transação com rollback: baixa parcial, idempotência por chave de requisição, recusa de baixa acima do saldo, recusa de data futura, recusa de cancelamento sobre baixa ativa, estorno, cancelamento e auditoria. Conferido também que as seis tabelas têm RLS ligada, nenhum privilégio para `anon`/`authenticated`, e que a chave pública recebe *permission denied*.

## Lançamentos e contratos

Valores monetários usam centavos inteiros. Lançamentos têm competência separada de vencimento. Baixas têm data, valor parcial, forma/conta e referência do comprovante. Dar baixa é uma conciliação **manual**, não uma consulta bancária ou emissão de cobrança.

Receitas e despesas avulsas ou mensais podem ter de 1 a 120 parcelas. O valor informado é o de **cada parcela**. A marcação de receita recorrente determina a entrada no MRR; uma campanha parcelada não é necessariamente recorrente. Cancelar não apaga o histórico. Encerrar próximas parcelas cancela as sem baixas desde a parcela selecionada; valores já baixados permanecem.

Ao abrir/atualizar o financeiro, contratos assinados completos geram os lançamentos faltantes. A chave contrato + índice da parcela impede duplicação. São usados projeto, início, assinatura, dia de vencimento (1–28), valor, meses/parcelas, pré/pós e escalonamento. No pré, o vencimento segue o mês anterior, limitado pela assinatura. O total do projeto segue o mesmo cálculo do documento; eventuais centavos indivisíveis são distribuídos entre parcelas.

Contratos incompletos aparecem como pendência. Alterações posteriores não reescrevem lançamentos, baixas ou histórico: divergências aparecem para conferência. Contratos encerrados ou removidos com lançamentos existentes também geram aviso; cabe ao dono cancelar o que deixar de ser devido. Alterar um lançamento não altera o contrato nem as outras parcelas.

## Indicadores

- Receita/DRE: lançamentos não cancelados por competência; o resultado inclui valores ainda não recebidos.
- Caixa: saldo inicial mais baixas de entrada menos baixas de saída desde a data-base até hoje; estornos não contam. Retiradas de lucro afetam caixa e não resultado operacional.
- Impostos: 6% sobre o faturamento por padrão. Valor explicitamente lançado no mês substitui a estimativa; nunca somam. Sem lançamento e sem alíquota, imposto/resultado/margem ficam sem estimativa.
- Lucro bruto: receita menos imposto e produção. Resultado gerencial: lucro bruto menos operação, ferramentas, aquisição, pró-labore e outros custos.
- MRR: receita recorrente da competência, independentemente da baixa. ARR = MRR × 12, ritmo anual, sem presumir vigência ou renovação por 12 meses.
- Ticket: receita vinculada a clientes ÷ clientes faturados no mês. ARPA: MRR ÷ clientes recorrentes.
- Churn: clientes recorrentes do mês anterior ausentes no atual ÷ clientes recorrentes anteriores. Expiração de contrato sem renovação também conta como saída.
- LTV estimado: ARPA × margem bruta ÷ churn. Sem churn positivo/margem válida, mostra indisponível, não infinito. Uma janela mensal curta pode variar muito.
- CAC: despesas de aquisição/marketing ÷ novos clientes recorrentes identificados no mês. Depende de histórico e classificação dos gastos.
- Ponto de equilíbrio: custo operacional ÷ margem de contribuição. Reserva em meses: caixa ÷ média de despesas dos meses observados.
- Saúde: sem registros → sem dados; imposto ausente → configuração incompleta; caixa ou resultado negativo → crítica; vencidos ou margem abaixo do alvo → atenção; demais casos → saudável. É uma regra gerencial visível, não uma avaliação externa de crédito.
- Histórico: três meses anteriores. Meses sem registros são lacunas, não zeros. Projeção contratada usa contas futuras por vencimento; referência histórica usa média dos meses observados; simulador aplica crescimento e churn compostos sobre MRR, com custo mensal fixo editável.

DRE gerencial simplificada: não inclui escrituração fiscal, balanço patrimonial, depreciação, estoque ou conciliação bancária automática.

## Satisfação e preço

A pesquisa existente coleta nota de satisfação, não uma pergunta formal de recomendação. O painel chama o índice de aproximação no modelo NPS: percentual de notas 9–10 menos percentual de notas 0–6, usando a última nota de cada cliente. Não apresenta a aproximação como NPS formal.

O preço-base = custo com rateio ÷ (1 − imposto − margem-alvo). Uma nota 9–10 pode aplicar um adicional **simulado e configurável**, inicialmente 5%. Notas baixas indicam correção da experiência; não reduzem o preço abaixo do custo/margem. Não altera preço contratado ou cobranças automaticamente. Sem custo ou imposto válidos, não gera sugestão.

## Margem por cliente

Calculada, não digitada. Receita do cliente na competência menos três custos: imposto sobre o que ele fatura, produção lançada na conta dele e a fatia das ferramentas do mês. Ferramenta é assinatura da empresa e não vem carimbada por cliente, então é rateada pela participação dele na receita do mês — quem fatura mais puxa mais. Sem receita no mês, não há rateio.

Operacional, marketing e pró-labore ficam de fora: são custo de existir a empresa, não custo de atender aquele cliente. Somá-los faria todo cliente parecer deficitário nos meses fracos. O campo de custo do simulador de preço continua editável, mas nasce preenchido com produção mais ferramentas rateadas.

## Contratos que terminam e reajuste

Contrato assinado que chega ao fim da vigência dentro de 30 dias vira aviso interno para o dono. Contrato que vence sem renovar tira o cliente do MRR em silêncio, e o churn só conta depois de consumado.

O reajuste anual é um percentual fixo configurado, aplicado a cada 12 parcelas de contrato recorrente de valor fixo. Não é índice: ninguém aqui consulta IPCA. Escalonado e parcelamento de projeto não são reajustados — os valores já estão escritos no contrato assinado.

## Produção da equipe

Tabela inicial: Reels 70/280; estáticos 50/200; carrosséis até 8 cards 100/400 (unidade/pacote de cinco); manual de marca 350; apresentação Canva animada até 15 slides 300. Card adicional custa 20.

Só conta quem produz peça: editor de vídeo e designer, que no app são **diretor criativo**. Social media e dono não recebem por tarefa — o trabalho deles não é medido em peça entregue.

Uma peça gera um pagamento só. Quando mais de um diretor criativo passou pela tarefa, recebe quem ficou com ela mais tempo até a entrega; empate fica com quem estava com ela no fim. A conta sai da atividade da tarefa, que registra toda troca de responsável com valor antigo, novo e hora — não é estimativa. Tarefa sem nenhum diretor criativo aparece como pendência nomeada e não gera pagamento para ninguém; é sinal de processo a corrigir, não de valor a pagar.

O formato é sugerido por etiqueta/nome e pode ser corrigido na conferência. Os grupos de cinco consideram o mesmo projeto, pacote, formato e diretor criativo creditado; sobras são unitárias. O prazo parte do cadastro da tarefa, em horário de São Paulo, e a primeira passagem por entrega ao cliente serve como evidência de entrega. O dono pode corrigir a data. Problema de qualidade precisa ser confirmado na conferência.

A produção é estimativa até o dono lançar a despesa. Sem formato, responsável ou evidência de entrega, não há despesa automática. O lançamento guarda valor e regra aplicada; mudar a tabela depois não muda valores já lançados. A mesma tarefa não pode gerar duas despesas automáticas. Escopos além da tabela devem ser negociados e cadastrados como despesa manual.

## Régua de cobrança

Interna, e só. O plano do cliente abre por link, sem login: qualquer número financeiro naquela tela publicaria a situação de um cliente para quem receber o endereço. A régua avisa o dono dentro do app, e a cobrança sai pela mão de uma pessoa.

Avisa três dias antes do vencimento, no dia, e depois com o vencido em 1, 7, 15 e 30 dias. Vencido não avisa todos os dias: aviso diário vira ruído e some junto com o resto. Recebível quitado, cancelado ou ainda distante não gera nada.

## Inadimplência e portal

O botão exige recebível vencido em aberto e motivo. O bloqueio é manual e reversível; pagar não desbloqueia automaticamente. O link de entrada, a página e as APIs de itens, aprovação, alteração de data e satisfação consultam o bloqueio. Uma sessão já aberta perde o acesso; o polling limpa os itens e redireciona na próxima atualização. Não há comunicação com bureaus de crédito. Formulários de pesquisa `/p` são independentes e continuam públicos.

## Verificação

`npm run test:unit -- tests/finance-calculations.test.ts tests/finance-access.test.ts tests/finance-database.test.ts tests/finance-validation.test.ts tests/finance-ui.test.tsx`

Também foram exercitados os testes de aprovação do cliente e de permissões. A interface foi conferida em navegador com dados de exemplo, em desktop e celular. Dados de demonstração ficam exclusivamente em `tests/fixtures`.

## Referências de conceitos

- [Stripe — receita mensal recorrente](https://stripe.com/resources/more/what-is-monthly-recurring-revenue).
- [Stripe — métricas de assinaturas e LTV](https://docs.stripe.com/billing/subscriptions/analytics).
- [Sebrae — implantação de fluxo de caixa](https://sebrae.com.br/sites/PortalSebrae/bis/implantando-a-planilha-de-fluxo-de-caixa-no-seu-dia-a-dia%2C9b183adc5f62d410VgnVCM2000003c74010aRCRD).

As regras comerciais de produção, desconto, prazo e bloqueio vêm do pedido do dono, com configurações explícitas no módulo.
