-- 1. Conteúdo com data fixa. É o que a reorganização automática do calendário
-- nunca move: 7 de setembro no dia 8 não é conteúdo, é erro. Antes disso a
-- informação só existia implícita no nome do grupo ("Estáticos | sazonais").
alter table tasks add column if not exists seasonal boolean not null default false;

update tasks t set seasonal = true
from plan_captacoes c
where c.id = t.captacao_id and lower(c.label) like '%sazona%';

-- 2. A ficha do cliente. Separada de projects porque projects é cadastro
-- (nome, status) e isto é contexto de trabalho: quem decide, o que ele quer,
-- o que já foi tentado.
create table if not exists project_profiles (
  project_id uuid primary key references projects(id) on delete cascade,
  razao_social text,
  documento text,
  endereco text,
  cidade text,
  segmento text,
  site text,
  responsavel_nome text,
  responsavel_telefone text,
  responsavel_email text,
  objetivos text,
  publico text,
  historico text,
  observacoes text,
  updated_at timestamptz not null default now()
);
alter table project_profiles enable row level security;

-- 3. Acessos do cliente. secret_encrypted guarda AES-256-GCM (ver
-- crypto-secrets.ts), nunca texto puro: o banco é lido por muita gente e por
-- muita coisa, e um dump de depuração não pode virar vazamento de senha.
create table if not exists project_credentials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  kind text not null default 'outro',
  username text,
  url text,
  notes text,
  secret_encrypted text,
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_credentials_project_id_idx on project_credentials(project_id);
alter table project_credentials enable row level security;
