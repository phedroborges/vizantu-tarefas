-- O que a tarefa É, pra decidir as seções da descrição. Antes isso era
-- adivinhado por "tem plan_id ou não": item de plano ganhava roteiro e legenda
-- (inclusive uma etapa de marca, que não tem nem uma coisa nem outra) e tarefa
-- avulsa caía num textarea solto, sem estrutura nenhuma.
--
-- Só existem dois valores porque só existem duas descrições possíveis: quem
-- vira publicação tem roteiro e legenda, quem não vira só tem direcionamento e
-- referência. Marca não entra aqui — quando a tarefa está dentro de um plano,
-- é o kind do plano que manda (ver hasContentSections em description-sections).
alter table tasks
  add column if not exists kind text not null default 'tarefa';

alter table tasks drop constraint if exists tasks_kind_check;
alter table tasks
  add constraint tasks_kind_check check (kind in ('tarefa', 'conteudo'));

-- Backfill: tarefa avulsa que já tem roteiro ou legenda escritos é conteúdo,
-- e o seletor precisa nascer marcado nela — senão o próximo que abrir vê os
-- dois blocos só porque têm texto, e não porque a tarefa é o que é.
update tasks
   set kind = 'conteudo'
 where plan_id is null
   and (description like '%**Roteiro**%' or description like '%**Legenda**%');
