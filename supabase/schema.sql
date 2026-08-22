-- Vizantu Tarefas — schema do Supabase (Postgres)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase (uma vez).
-- Acesso é sempre via SUPABASE_SERVICE_ROLE_KEY, só no servidor (rotas /api do
-- Next.js) — por isso RLS fica desligado: não há cliente acessando direto.

create extension if not exists "pgcrypto";

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('formato', 'canal')),
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  due_date date,
  assignee_id uuid references members(id) on delete set null,
  description text,
  drive_link text,
  format_tag_ids uuid[] not null default '{}',
  channel_tag_ids uuid[] not null default '{}',
  status text not null default 'rascunho',
  status_history jsonb not null default '[]',
  comments jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_project_id_idx on tasks(project_id);
create index if not exists tasks_assignee_id_idx on tasks(assignee_id);

create table if not exists knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Nova conversa',
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bucket de Storage para imagens anexadas no chat da IA (crie manualmente pelo
-- painel do Supabase — Storage > New bucket — marcado como "Public", com o
-- mesmo nome que você colocar em SUPABASE_STORAGE_BUCKET no .env; o padrão
-- que o app espera é "vizantu-tarefas-uploads").

-- ---------- Autenticação + papéis (rodar depois do bloco acima) ----------
-- A partir daqui, members.id É o auth.users.id — todo membro novo é criado via
-- supabase.auth.admin.createUser() e o insert em members usa o MESMO id.

alter table members
  add column if not exists email text,
  add column if not exists role text not null default 'editor'
    check (role in ('dono', 'editor', 'visualizador')),
  add column if not exists ai_enabled boolean not null default false;

create unique index if not exists members_email_idx on members (lower(email)) where email is not null;

-- members está vazia neste projeto (confirmado antes de aplicar isto) — não
-- há necessidade de re-chavear nenhuma linha existente pra bater com o
-- auth.users.
alter table members
  add constraint members_id_fkey foreign key (id) references auth.users(id) on delete cascade;

create table if not exists project_access (
  member_id uuid not null references members(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, project_id)
);
create index if not exists project_access_member_id_idx on project_access(member_id);

-- ---------- Imagens na descrição + duplicação de tarefas ----------
-- Duplicação não precisa de coluna nova — é só um insert com os mesmos
-- campos e id/status_history/comments zerados (ver duplicateTask em storage.ts).

alter table tasks
  add column if not exists images text[] not null default '{}';

-- ---------- Listas de tarefas (Interna / Externa) ----------
-- Uma tarefa pode pertencer às duas listas ao mesmo tempo — é a MESMA linha
-- (sincronizada por natureza, não uma cópia); "lists" só marca em quais
-- listas ela aparece. Vazio = não entra em nenhuma lista específica.

alter table tasks
  add column if not exists lists text[] not null default '{}';

-- Acesso por lista, só relevante pro papel "visualizador" (mesmo padrão de
-- project_access) — controla quais das duas listas a pessoa enxerga.
create table if not exists member_list_access (
  member_id uuid not null references members(id) on delete cascade,
  list_kind text not null check (list_kind in ('interna', 'externa')),
  created_at timestamptz not null default now(),
  primary key (member_id, list_kind)
);
create index if not exists member_list_access_member_id_idx on member_list_access(member_id);

-- ---------- Cores por etapa do status ----------
-- Só guarda as etapas que o usuário customizou — o resto cai no default de
-- DEFAULT_STATUS_COLORS (src/lib/types.ts), que reproduz as cores atuais por
-- grupo. Assim a tabela pode ficar vazia sem quebrar nada.
create table if not exists status_colors (
  status text primary key,
  color text not null,
  updated_at timestamptz not null default now()
);

-- ---------- Planos, conteúdo, avisos (unificação com o vizantu-planos) ----------
-- Container "Plano" (conjunto de conteúdos ou de passos de um processo).
-- kind=presentation nunca vira linhas estruturadas — continua 100% no
-- pipeline de blob do vizantu-planos.
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('content', 'process', 'presentation')),
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  approval_deadline timestamptz,
  approval_period_days int,
  -- planos "presentation" (e planos legados ainda não migrados) continuam
  -- servidos pelo storage.ts de blob do vizantu-planos; estas colunas fazem
  -- a ponte sem forçar os dois mundos numa mesma forma.
  legacy_slug text unique,
  html_blob_key text,
  source text not null default 'native' check (source in ('native', 'legacy_blob')),
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plans_project_id_idx on plans(project_id);
alter table plans enable row level security;

-- Agrupamento de captação ("1ª Captação", "2ª Captação"...) — tabela em vez
-- de texto solto pra não quebrar o agrupamento por variação de digitação.
-- Só existe pra planos kind=content; label e quantidade são livres.
create table if not exists plan_captacoes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  label text not null,
  sequence_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists plan_captacoes_plan_id_idx on plan_captacoes(plan_id);
alter table plan_captacoes enable row level security;

-- Responsáveis da sessão: quem grava e quem edita. O editor é herdado pelos
-- conteúdos da captação, salvo quando o conteúdo recebe uma exceção manual.
alter table plan_captacoes
  add column if not exists package_kind text not null default 'creation'
    check (package_kind in ('capture', 'creation')),
  add column if not exists recording_assignee_id uuid references members(id) on delete set null,
  add column if not exists editing_assignee_id uuid references members(id) on delete set null;

-- Um item de conteúdo de um Plano (vídeo/post/carrossel) OU um passo de um
-- Plano de processo é uma linha de tasks — reaproveita responsável, status,
-- status_history, comentários, IA, anexos que já existem. Colunas novas são
-- todas nullable: zero impacto nas tarefas existentes que não pertencem a
-- nenhum plano.
alter table tasks
  add column if not exists plan_id uuid references plans(id) on delete cascade,
  add column if not exists captacao_id uuid references plan_captacoes(id) on delete set null,
  add column if not exists category_tag_ids uuid[] not null default '{}',
  add column if not exists sequence_order int;       -- ordem de exibição (planos de processo)

alter table tasks
  add column if not exists assignee_source text
    check (assignee_source in ('manual', 'captacao'));

-- Direcionamento, roteiro, referência e legenda NÃO são colunas próprias —
-- são seções escritas dentro de tasks.description (markdown-lite, com os
-- títulos em **negrito**). Menos campos pra preencher, e o mesmo texto serve
-- pra qualquer formato (vídeo, carrossel, estático). Uma versão anterior
-- deste schema criou script_text/direction_text/reference_text/caption_text;
-- o drop abaixo existe pra bancos que passaram por aquela versão.
alter table tasks
  drop column if exists script_text,
  drop column if exists direction_text,
  drop column if exists reference_text,
  drop column if exists caption_text;

create index if not exists tasks_plan_id_idx on tasks(plan_id);
create index if not exists tasks_captacao_id_idx on tasks(captacao_id);

-- Categorias de conteúdo (trends/collab/autoridade/educação, livre) —
-- reaproveita o mecanismo de tags que já existe pra formato/canal, inclusive
-- resolve-ou-cria por nome que a IA já usa.
alter table tags drop constraint if exists tags_kind_check;
alter table tags add constraint tags_kind_check check (kind in ('formato', 'canal', 'categoria'));


-- Status de aprovação do CLIENTE — eixo separado do status de produção
-- interna em tasks.status (uma tarefa pode estar "em_criacao" pra um cliente
-- que nunca viu aquilo). 1:1 com tasks; só existe pra itens client-facing.
create table if not exists plan_item_approvals (
  task_id uuid primary key references tasks(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested', 'rejected')),
  review_version int not null default 1,
  updated_at timestamptz not null default now()
);
alter table plan_item_approvals enable row level security;

-- Respostas individuais (multi-revisor — várias pessoas podem responder o
-- mesmo item via o mesmo link). Status agregado do item = pior status vence
-- (rejected > changes_requested > approved), calculado em cima destas linhas.
create table if not exists plan_approval_responses (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  reviewer_name text not null,
  status text not null check (status in ('approved', 'changes_requested', 'rejected')),
  comment text,
  review_version int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists plan_approval_responses_task_id_idx on plan_approval_responses(task_id);
alter table plan_approval_responses enable row level security;

-- Histórico completo (timeline de versões no dashboard interno).
create table if not exists plan_approval_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  action text not null check (action in ('approved', 'changes_requested', 'rejected', 'commented', 'reopened')),
  status text not null,
  previous_status text not null,
  comment text,
  reviewer_name text,
  review_version int,
  created_at timestamptz not null default now()
);
create index if not exists plan_approval_events_task_id_idx on plan_approval_events(task_id);
alter table plan_approval_events enable row level security;

-- "Nota da vizantu" (satisfação) do dashboard — sem equivalente hoje.
create table if not exists client_satisfaction_scores (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  score int not null check (score between 0 and 10),
  created_at timestamptz not null default now()
);
create index if not exists client_satisfaction_scores_project_id_idx on client_satisfaction_scores(project_id);
alter table client_satisfaction_scores enable row level security;

-- Entradas de calendário que não são conteúdo (ex: "LOJA APPLE — Projeção ·
-- Apresentação") — aparecem junto com os conteúdos no calendário do cliente.
create table if not exists plan_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  event_type text not null default 'reuniao',
  event_date date not null,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists plan_events_project_id_idx on plan_events(project_id);
alter table plan_events enable row level security;

-- Aviso: broadcast pra todos / uma categoria (role) / um usuário específico.
-- Some da tela do destinatário só quando ele confirma explicitamente — ver
-- announcement_acknowledgements.
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text not null,
  created_by uuid references members(id) on delete set null,
  scope text not null check (scope in ('all', 'role', 'member')),
  scope_role text check (scope_role in ('dono', 'editor', 'visualizador')),
  scope_member_id uuid references members(id) on delete cascade,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists announcements_active_idx on announcements(active) where active;
alter table announcements enable row level security;

create table if not exists announcement_acknowledgements (
  announcement_id uuid not null references announcements(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (announcement_id, member_id)
);
alter table announcement_acknowledgements enable row level security;

-- ---------- Rename: listas interna/externa -> estrategica/criativa ----------
-- Mesmo conceito de antes, ganhando movimentação automática por status (ver
-- deriveListsForStatus em src/lib/storage.ts). Rodado uma única vez em
-- produção com member_list_access e tasks.lists ainda vazios — os UPDATEs
-- abaixo continuam corretos caso este arquivo seja reaplicado do zero num
-- banco novo (tornam-se no-ops).
update tasks set lists = array(
  select case elem when 'interna' then 'estrategica' when 'externa' then 'criativa' else elem end
  from unnest(lists) as elem
) where lists && array['interna', 'externa'];

alter table member_list_access drop constraint if exists member_list_access_list_kind_check;
update member_list_access set list_kind = 'estrategica' where list_kind = 'interna';
update member_list_access set list_kind = 'criativa' where list_kind = 'externa';
alter table member_list_access add constraint member_list_access_list_kind_check
  check (list_kind in ('estrategica', 'criativa'));

-- ---------- O cliente É o projeto ----------
-- Não existe entidade "cliente" separada: os 8 projetos são as 8 contas de
-- cliente. Os dados de exibição (o que aparece no cabeçalho do painel que o
-- cliente acessa) moram no próprio projeto, e o link de acesso pendura nele.
-- Uma versão anterior deste schema criou plan_clients/plan_client_tokens —
-- os drops abaixo existem pra bancos que passaram por aquela versão.
alter table projects
  add column if not exists client_role text,
  add column if not exists client_city text,
  add column if not exists client_instagram text;

create table if not exists client_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_links_project_id_idx on client_links(project_id);
alter table client_links enable row level security;

drop table if exists plan_client_tokens;
drop table if exists plan_clients;
