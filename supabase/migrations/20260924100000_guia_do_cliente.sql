-- ---------- O guia do cliente ----------
-- A ficha antiga (project_profiles) tinha quatro textareas genéricas:
-- objetivos, publico, historico e observacoes. Em catorze clientes, treze
-- estavam completamente vazios. O problema não era o texto ser pouco, era não
-- existir pergunta nenhuma — ninguém abre uma caixa chamada "Observações" pra
-- escrever o que o cliente é enjoado.
--
-- O guia troca as quatro caixas por dezoito perguntas de verdade, agrupadas em
-- cinco blocos (ver CLIENT_GUIDE_BLOCKS em src/lib/client-guide.ts, que é a
-- fonte única de verdade sobre rótulo, bloco e ordem). As colunas antigas
-- continuam aqui de propósito: são backup do que já foi escrito e nunca mais
-- são lidas pela interface.

alter table project_profiles
  -- Quem é
  add column if not exists quem_eh text,
  add column if not exists de_onde_veio text,
  add column if not exists o_que_faz text,
  add column if not exists produto_servico text,
  add column if not exists historia_dele text,
  add column if not exists como_trabalha text,
  -- O que ele quer
  add column if not exists desejo text,
  add column if not exists por_que_nos_procurou text,
  -- Como lidar
  add column if not exists perfil_do_cliente text,
  add column if not exists pontos_de_precisao text,
  add column if not exists problemas_anteriores text,
  -- Como o trabalho é feito
  add column if not exists estrategia text,
  add column if not exists como_executar text,
  add column if not exists temas_sugeridos text,
  add column if not exists formatos_sugeridos text,
  add column if not exists referencias text,
  -- Pessoal
  add column if not exists tamanho_camiseta text,
  add column if not exists gostos_pessoais text;

-- Quais campos foram escritos à mão. A IA remonta o guia toda vez que entra
-- uma reunião nova, e sem esta lista ela apagaria a correção que o dono fez
-- na semana passada. Campo que está aqui a geração não encosta.
alter table project_profiles
  add column if not exists guide_manual_fields text[] not null default '{}',
  add column if not exists guide_generated_at timestamptz;

-- ---------- A matéria-prima do guia ----------
-- O dono faz três ou quatro reuniões antes de o trabalho começar. O guia é o
-- resultado; isto aqui é o material bruto que gerou ele. Fica separado porque
-- a geração é re-executável: entra a quinta reunião, a IA relê TUDO e
-- reescreve o guia, em vez de tentar remendar o texto anterior.
create table if not exists project_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  kind text not null default 'reuniao'
    check (kind in ('reuniao', 'transcricao', 'anotacao', 'documento', 'migrado')),
  content text not null,
  happened_on date,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_sources_project_id_idx on project_sources(project_id);
alter table project_sources enable row level security;

-- Migra o que já estava escrito nas quatro caixas antigas para uma fonte, pra
-- a IA conseguir assimilar junto com as reuniões novas. Só roda pra quem tem
-- algum texto, e só uma vez (o not exists evita duplicar numa reaplicação).
insert into project_sources (project_id, title, kind, content)
select
  p.project_id,
  'Contexto anterior (migrado da ficha antiga)',
  'migrado',
  concat_ws(
    E'\n\n',
    nullif(concat('Objetivos: ', p.objetivos), 'Objetivos: '),
    nullif(concat('Público: ', p.publico), 'Público: '),
    nullif(concat('Histórico: ', p.historico), 'Histórico: '),
    nullif(concat('Observações: ', p.observacoes), 'Observações: ')
  )
from project_profiles p
where coalesce(p.objetivos, p.publico, p.historico, p.observacoes) is not null
  and not exists (
    select 1 from project_sources s
    where s.project_id = p.project_id and s.kind = 'migrado'
  );
