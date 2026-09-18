# Desempenho no EasyPanel

## Diagnóstico de 16/09/2026

O código já usa `next build` e servidor standalone no Dockerfile. Não havia evidência de execução com `next dev` na VPS. O banco configurado é Supabase Cloud; a VPS serve o Next.js, e cada consulta envolve rede externa.

Gargalos identificados e corrigidos:

- Projeto individual lia tarefas e contratos de todos os projetos antes de filtrar. Agora envia o projeto e as listas autorizadas na consulta; os índices existentes em `project_id` podem ser usados.
- Cards de projetos recebiam descrições, imagens, comentários e históricos para contar tarefas. Agora consultam somente projeto, status, prazo e listas, com paginação para não truncar as contagens.
- Dashboard recebia o histórico completo das tarefas e calculava indicadores tanto na renderização quanto na hidratação. Agora calcula no servidor e envia apenas o resultado.
- `Promise.all` no portal e na lista de planos continha `await` nos argumentos. As consultas eram seriadas; agora começam juntas, com propagação de erros preservada.
- Avisos de contrato carregavam todo o financeiro, todas as tarefas e geravam parcelas a cada varredura. Agora leem somente membros, contratos e projetos. Avisos de atraso consultam somente tarefas vencidas com responsável, em lotes de 500, sem carregar históricos ou consultar planos. Varreduras sobrepostas compartilham uma execução.
- Abrir o financeiro reenviava todas as parcelas contratuais para `upsert`. Agora envia apenas parcelas ausentes, preservando alterações e cancelamentos; as leituras independentes ocorrem juntas.
- APIs validavam a sessão no proxy e novamente no handler. Agora o handler valida e renova os cookies; nas páginas o proxy valida claims e a guarda mantém a checagem atualizada de usuário ativo e permissões. Referência: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
- `GET https://tarefas.metricz.com.br/fonts/mona-sans-latin.woff2` retornou **307 para login** na versão publicada. Fontes agora ficam fora do matcher de autenticação.
- Datas recriavam `Intl.DateTimeFormat` a cada chamada. O teste local de 3.000 formatações passou de aproximadamente 86 ms para 1,6 ms reutilizando o formatador. É um microbenchmark, não uma medida do tempo total de uma página; a data atual continua sendo lida em cada chamada.
- Modais de tarefa e widget do assistente são carregados sob demanda. O sino consulta seis notificações e uma contagem exata de não lidas; pausa em abas ocultas, cancela no unmount e impede consultas sobrepostas.

Nenhum cache compartilhado de dados privados foi introduzido. Não é necessária migração de banco para estas alterações.

## Medir após publicar

A imagem precisa ser reconstruída e publicada pelo EasyPanel para que as alterações entrem em vigor. Confirmar que usa o Dockerfile do repositório e `node server.js`, não o servidor de desenvolvimento.

Chamadas ao Supabase que demoram pelo menos 1 segundo até os cabeçalhos geram no log do container:

```json
{"event":"slow_supabase_request","service":"database","durationMs":1450,"status":200}
```

`service` distingue `database` de `auth`. `APP_SLOW_QUERY_MS` configura o limiar em milissegundos (padrão 1000). Não são registrados URLs, filtros, conteúdo, cookies ou credenciais. Isso mede a chamada externa, não o tempo de renderização nem o download do corpo completo.

No terminal da VPS, durante uma navegação lenta, capturar:

```sh
docker stats --no-stream
free -h
vmstat 1 10
df -h
```

Comparar CPU e memória do container com as demais aplicações, pressão de swap (`si`/`so`) e espera de disco (`wa`). No navegador, medir as mesmas páginas autenticadas antes/depois, usando a aba Network: duração do documento/RSC, tamanho transferido e chamadas de API. Confirmar resposta 200 e tipo de fonte correto para `/fonts/mona-sans-latin.woff2`.

Esta revisão local não teve credenciais de produção nem acesso SSH/EasyPanel. Não mediu CPU, memória ou tempo das páginas autenticadas na VPS. O login público respondeu em cerca de 0,4 s numa amostra; isso não representa as telas internas nem descarta pressão de recursos sob carga.

## Validação local

- Suíte unitária: 422 testes passaram, 5 foram pulados pela configuração existente. Dois testes adicionados depois (virada do dia e varredura concorrente) também passaram.
- Build de produção e TypeScript passaram.
- Navegador: tabela, abertura do modal sob demanda, calendário e dashboard com oito indicadores, usando os dados de demonstração da prévia. Sem erros de execução nas telas verificadas.
- Servidor standalone: fonte retornou 200 `font/woff2`, sem redirect; APIs de tarefas, notificações e financeiro retornaram 401 JSON sem sessão; `/tarefas` redirecionou ao login.
- Testes de persistência garantem que parcelas já importadas não são reescritas e que parcelas novas retornam com sua auditoria atualizada.


## Revisão de tarefas e financeiro — 18/09/2026

A lista de tarefas ainda usava a consulta completa. Esta revisão remove descrições, comentários, anexos e histórico da leitura inicial, evita a consulta adicional de tipos de plano e preserva todos os resultados com lotes de 1.000. A tabela monta 50 linhas por página; filtros e calendário continuam considerando o conjunto completo. O modal busca a tarefa completa com autorização antes de permitir edição. Contagens de comentários/anexos são opcionais e carregadas somente quando exibidas no calendário.

O financeiro agora carrega contratos/indicadores e produção separadamente. A visão geral não lê tarefas; a aba de produção não depende de contratos, NPS, bloqueios ou auditoria. A consulta de produção mantém histórico de status e autoria para apurar as entregas, mas não envia descrições nem anexos. O cálculo de produção ocorre uma vez por conjunto de dados. O resumo mensal mostra todos os diretores criativos, inclusive sem entregas, com pendências de conferência, carteira em produção e valores apurados/lançados/pendentes. O fechamento continua recalculado no servidor, com chave única por tarefa.

Leituras do Supabase têm limite de 15 segundos por requisição; escritas e uploads têm 60 segundos. O painel financeiro permite nova tentativa e trata respostas de erro sem JSON. Esses limites evitam espera indefinida; não são uma garantia de tempo total de carregamento.

Validação: 461 testes passaram e 5 permaneceram pulados pela configuração existente. Cobertura de consulta leve com mais de 1.000 tarefas, paginação/busca fora da primeira página, autorização de detalhes e financeiro, preservação do conteúdo antes da edição, independência entre contratos e produção, cancelamento de requisições e resumo por diretor. Interface conferida em navegador com os dados de demonstração. Build de produção e TypeScript passaram.

Uma consulta sem leitura de linhas (`limit=0`) confirmou a existência das tabelas financeiras no banco configurado; o acesso anônimo às tabelas financeiras permanece recusado. Não há sessão autenticada de produção nem acesso ao EasyPanel neste ambiente: a causa exata da falha financeira e o tempo das telas internas na VPS precisam ser confirmados nos logs e no navegador após o deploy. Nenhuma migration nova é exigida por esta revisão.
