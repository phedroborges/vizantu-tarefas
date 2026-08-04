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
