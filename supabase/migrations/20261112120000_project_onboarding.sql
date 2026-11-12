-- Onboard de cada cliente: o checklist padrão da Vizantu.
--
-- A lista de itens mora no código (src/lib/onboarding/checklist.ts). Aqui fica
-- só o que cada cliente já fez: quais itens estão marcados (chave -> data da
-- marcação), as respostas da ficha (tem site, CRM, ERP) e as observações.
-- Só o servidor lê e escreve (RLS ligado, sem política), como no resto do app.

create table if not exists public.project_onboarding (
  project_id uuid primary key references public.projects(id) on delete cascade,
  checks jsonb not null default '{}'::jsonb,
  fields jsonb not null default '{}'::jsonb,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.project_onboarding enable row level security;
