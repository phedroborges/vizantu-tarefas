# Planos mensais — aplicação na VPS

O deploy do Next.js não executa migrations do Supabase. Antes de publicar esta versão:

1. No Supabase usado pela VPS, aplicar `supabase/migrations/20261015191508_automatic_monthly_plan_lifecycle.sql` no SQL Editor (ou pelo fluxo de migrations da instalação). Pressupõe a migration anterior `20261015120000_plano_mensal.sql` já aplicada.
2. No EasyPanel, fazer deploy do branch `main` de `phedroborges/vizantu-tarefas` com o Dockerfile existente.
3. Conferir em Planos → cliente: o seletor de mês vem antes de qualquer demanda. Outubro abre por padrão; setembro aparece encerrado ao ser selecionado; novembro já está criado. O diretor criativo vê apenas suas tarefas ao entrar no plano.
4. Dentro de outubro, copiar Link do cliente. O endereço inclui `?plan=<id>` e abre somente aquele plano. O seletor do portal oferece planos atuais/futuros e campanhas, sem “Todos”. Planos encerrados não aceitam respostas, inclusive por URLs antigas.
5. Adicionar um pacote de captação, carrossel ou estático: o padrão é cinco conteúdos criados dentro do pacote, com formato e responsáveis definidos no formulário.

## Dados e virada do mês

- Cliente novo recebe o mês atual e os dois seguintes. O agendador existente e a abertura do painel repõem os próximos meses.
- Toda nova tarefa recebe o plano do mês da criação em São Paulo, inclusive sem prazo. Escolher outro plano prevalece; editar o prazo não transfere a tarefa.
- Tarefas antigas sem plano são vinculadas ao mês de criação. Os planos e pacotes já escolhidos permanecem.
- O mês encerrado fica consultável internamente, mas sai da aprovação e das filas ativas. O status de produção e o histórico não são falsificados como “finalizado”.
- As pendências recebem aviso e podem ser transferidas. A partir do dia 25, o painel destaca as tarefas do mês que precisam continuar; o aviso interno é deduplicado por mês/plano/pessoa.
- Transferir preserva prazo, histórico e decisões, e replica o pacote no destino. Depois da transferência, o prazo pode ser replanejado normalmente.

## Verificação

Testes cobrem criação automática, tarefas sem prazo, escolha manual de plano, isolamento do portal, mês encerrado, transferências, visão do criativo e criação transacional dos pacotes. A migration é executada em PostgreSQL local (PGlite), sem alterar dados reais.

O acesso conectado nesta sessão não tem permissão no projeto Supabase `sazagrbqmucgpicmfqil`. A aplicação da migration e o deploy no EasyPanel precisam ocorrer na instalação; não foram executados por esta sessão.
