-- Comunicação com o cliente pelo WhatsApp.
--
-- Três tabelas, todas só do servidor (RLS ligado, sem política: quem lê e
-- escreve é a service role, como no resto do app).
--
-- project_communication: o que cada cliente configurou — o grupo dele e o
-- prazo de aprovação.
-- whatsapp_messages: a fila de saída. Tudo que vai para um grupo passa por
-- aqui, então a mesma tabela é o histórico do que foi enviado e a trava que
-- impede mandar duas vezes (dedupe_key).
-- whatsapp_broadcasts: o comunicado que o time escreve uma vez e sai para
-- vários grupos, espaçado.

create table if not exists public.project_communication (
  project_id uuid primary key references public.projects(id) on delete cascade,
  whatsapp_group_id text,
  whatsapp_group_name text,
  notify_enabled boolean not null default true,
  approval_deadline_days integer not null default 7 check (approval_deadline_days between 1 and 60),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_broadcasts (
  id uuid primary key,
  title text not null,
  variations jsonb not null default '[]'::jsonb,
  media_url text,
  media_type text check (media_type in ('image', 'video', 'document')),
  project_ids uuid[] not null default '{}',
  interval_seconds integer not null default 90 check (interval_seconds between 20 and 3600),
  status text not null default 'sending' check (status in ('sending', 'done', 'cancelled')),
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key,
  project_id uuid references public.projects(id) on delete cascade,
  broadcast_id uuid references public.whatsapp_broadcasts(id) on delete cascade,
  kind text not null check (kind in ('approval', 'reminder', 'last_day', 'auto_approved', 'broadcast')),
  group_id text not null,
  body text,
  media_url text,
  media_type text,
  dedupe_key text unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_due on public.whatsapp_messages (scheduled_at) where status = 'pending';
create index if not exists whatsapp_messages_project on public.whatsapp_messages (project_id, created_at desc);

alter table public.project_communication enable row level security;
alter table public.whatsapp_broadcasts enable row level security;
alter table public.whatsapp_messages enable row level security;
