-- Relatórios de resultados de cada cliente.
--
-- O relatório é escrito fora do app e gravado pronto aqui, como dados (jsonb):
-- o PDF é gerado na hora de baixar, a partir deles. Não existe tela de criação.
-- Só o servidor lê e escreve (RLS ligado, sem política), como no resto do app.

create table if not exists public.project_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default 'Relatório de resultados',
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists project_results_project on public.project_results (project_id, created_at desc);

alter table public.project_results enable row level security;
