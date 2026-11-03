-- Fechamento do mês de cada pessoa da equipe. Guarda o que foi pago, item a
-- item, como estava no dia do fechamento: mudar tabela de preço, plano ou
-- equipe depois não reescreve o comprovante já enviado. A nota fiscal que a
-- pessoa devolve fica presa ao mesmo fechamento.
create table if not exists public.finance_closings (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  member_id uuid not null references public.members(id),
  competence text not null check (competence ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  total bigint not null,
  lines jsonb not null default '[]'::jsonb,
  task_ids uuid[] not null default '{}',
  closed_by uuid references public.members(id),
  closed_at timestamptz not null default now(),
  paid_on date,
  paid_by uuid references public.members(id),
  invoice_path text,
  invoice_name text,
  invoice_uploaded_at timestamptz,
  unique (member_id, competence)
);
alter table public.finance_closings enable row level security;
revoke all on public.finance_closings from anon, authenticated;
grant all on public.finance_closings to service_role;

-- Ajuste combinado no fechamento pode ser desconto. Só ele pode ser negativo.
alter table public.finance_entries drop constraint if exists finance_entries_amount_check;
alter table public.finance_entries add constraint finance_entries_amount_check
  check (amount <> 0 and abs(amount) <= 100000000000 and (amount > 0 or source_key like 'ajuste:%'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('mention', 'task_assigned', 'task_overdue', 'announcement', 'contract_ending', 'finance_closing'));

-- Nota fiscal é documento fiscal com CNPJ e valores: área privada, aberta só
-- por link temporário que o servidor gera para o dono ou para a própria pessoa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notas-fiscais', 'notas-fiscais', false, 10485760, array['application/pdf', 'application/xml', 'text/xml', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;
