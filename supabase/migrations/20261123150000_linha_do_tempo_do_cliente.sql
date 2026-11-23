-- Linha do tempo do cliente: sonho, objetivos, metas e marcos, cada um com o
-- período em que vale e a data em que foi dito. As regras (horizonte, ordem,
-- texto para a IA) moram em src/lib/timeline/model.ts.
--
-- Nada se apaga quando o cliente muda de ideia: o item antigo fica com status
-- 'substituido' e replaced_by aponta para o novo. Só o servidor lê e escreve
-- (RLS ligado, sem política), como no resto do app.

create table if not exists public.project_timeline (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('sonho', 'objetivo', 'meta', 'marco')),
  title text not null,
  detail text not null default '',
  starts_on date,
  ends_on date,
  said_on date,
  status text not null default 'vigente' check (status in ('vigente', 'alcancado', 'substituido', 'abandonado')),
  replaced_by uuid references public.project_timeline(id) on delete set null,
  source_id uuid references public.project_sources(id) on delete set null,
  source_label text,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_timeline_periodo check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index if not exists project_timeline_project_idx on public.project_timeline (project_id);

alter table public.project_timeline enable row level security;
