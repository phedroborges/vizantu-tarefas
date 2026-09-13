-- Valores monetários em centavos; tabelas acessíveis somente pelo servidor.
create table public.finance_settings (
  id boolean primary key default true check (id),
  data jsonb not null default '{}',
  updated_by uuid references public.members(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('income','expense')),
  category text not null check (category in ('servicos','campanha','outras_receitas','producao','operacional','ferramentas','marketing','prolabore','impostos','retiradas','outros_custos')),
  description text not null check (length(trim(description)) > 0),
  amount bigint not null check (amount > 0 and amount <= 100000000000),
  due_date date not null, competence text not null check (competence ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  project_id uuid references public.projects(id) on delete restrict,
  member_id uuid references public.members(id) on delete restrict,
  recurring boolean not null default false, series_id uuid,
  source_key text unique, cancelled boolean not null default false, notes text not null default '',
  updated_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((direction = 'income') = (category in ('servicos','campanha','outras_receitas')))
);
create index finance_entries_project on public.finance_entries(project_id);
create index finance_entries_member on public.finance_entries(member_id);
create index finance_entries_month on public.finance_entries(competence);
create index finance_entries_due on public.finance_entries(due_date) where not cancelled;
create index finance_entries_series on public.finance_entries(series_id);
create table public.finance_payments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.finance_entries(id) on delete restrict,
  amount bigint not null check (amount > 0), paid_at date not null,
  method text not null default '', reference text not null default '',
  reversed boolean not null default false,
  updated_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index finance_payments_entry on public.finance_payments(entry_id);
create index finance_payments_date on public.finance_payments(paid_at);
create table public.finance_project_blocks (
  project_id uuid primary key references public.projects(id) on delete cascade,
  blocked boolean not null default false, reason text not null default '',
  updated_by uuid references public.members(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.finance_production_reviews (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  data jsonb not null, updated_by uuid references public.members(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.finance_audit (
  id uuid primary key default gen_random_uuid(), entity_id text not null,
  action text not null, actor_id uuid, before_data jsonb, after_data jsonb,
  created_at timestamptz not null default now()
);
create index finance_audit_created on public.finance_audit(created_at desc);

create function public.finance_audit_change() returns trigger language plpgsql security invoker set search_path = '' as $$
declare old_value jsonb; new_value jsonb;
begin
  if tg_op <> 'INSERT' then old_value := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_value := to_jsonb(new); end if;
  insert into public.finance_audit(entity_id, action, actor_id, before_data, after_data)
  values (coalesce(new_value->>'id',new_value->>'project_id',new_value->>'task_id',old_value->>'id'),
    tg_table_name || ':' || tg_op, (new_value->>'updated_by')::uuid, old_value, new_value);
  return coalesce(new, old);
end $$;

-- O lock do lançamento serializa baixas, estornos e cancelamentos concorrentes.
create function public.finance_settle(p_entry uuid, p_amount bigint, p_date date, p_method text, p_reference text, p_actor uuid, p_request uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare entry public.finance_entries; total bigint; payment_id uuid;
begin
  select * into entry from public.finance_entries where id = p_entry for update;
  if exists(select 1 from public.finance_payments where id = p_request and entry_id = p_entry and amount = p_amount and paid_at = p_date) then return p_request; end if;
  if not found or entry.cancelled then raise exception 'Lançamento indisponível.'; end if;
  if p_date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'Uma baixa não pode ter data futura.'; end if;
  select coalesce(sum(amount),0) into total from public.finance_payments where entry_id = p_entry and not reversed;
  if p_amount <= 0 or total + p_amount > entry.amount then raise exception 'Valor maior que o saldo em aberto.'; end if;
  insert into public.finance_payments(id,entry_id,amount,paid_at,method,reference,updated_by)
  values(p_request,p_entry,p_amount,p_date,p_method,p_reference,p_actor) returning id into payment_id;
  return payment_id;
end $$;
create function public.finance_reverse(p_payment uuid, p_actor uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare target uuid;
begin
  select entry_id into target from public.finance_payments where id = p_payment;
  if target is null then raise exception 'Baixa não encontrada.'; end if;
  perform id from public.finance_entries where id = target for update;
  update public.finance_payments set reversed = true, updated_by = p_actor where id = p_payment and not reversed;
end $$;
create function public.finance_cancel(p_entry uuid, p_actor uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform id from public.finance_entries where id = p_entry for update;
  if not found then raise exception 'Lançamento não encontrado.'; end if;
  if exists(select 1 from public.finance_payments where entry_id = p_entry and not reversed) then
    raise exception 'Estorne as baixas antes de cancelar.';
  end if;
  update public.finance_entries set cancelled = true, updated_by = p_actor, updated_at = now() where id = p_entry;
end $$;

-- Sem policies para anon/authenticated: até o dono passa pela API autenticada.
-- SECURITY INVOKER + privilégios exclusivos do service_role evita RPC pública.
do $$ declare table_name text; begin
  foreach table_name in array array['finance_settings','finance_entries','finance_payments','finance_project_blocks','finance_production_reviews','finance_audit'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from anon, authenticated',table_name);
    execute format('grant all on public.%I to service_role',table_name);
    if table_name <> 'finance_audit' then
      execute format('create trigger finance_audit after insert or update or delete on public.%I for each row execute function public.finance_audit_change()',table_name);
    end if;
  end loop;
end $$;
revoke all on function public.finance_audit_change() from public, anon, authenticated;
revoke all on function public.finance_settle(uuid,bigint,date,text,text,uuid,uuid) from public, anon, authenticated;
revoke all on function public.finance_reverse(uuid,uuid) from public, anon, authenticated;
revoke all on function public.finance_cancel(uuid,uuid) from public, anon, authenticated;
grant execute on function public.finance_audit_change(), public.finance_settle(uuid,bigint,date,text,text,uuid,uuid), public.finance_reverse(uuid,uuid), public.finance_cancel(uuid,uuid) to service_role;

create function public.finance_edit(p_entry uuid, p_amount bigint, p_due date, p_competence text, p_description text, p_notes text, p_actor uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform id from public.finance_entries where id = p_entry and not cancelled for update;
  if not found then raise exception 'Lançamento indisponível.'; end if;
  if exists(select 1 from public.finance_payments where entry_id = p_entry and not reversed) then raise exception 'Estorne as baixas antes de editar o lançamento.'; end if;
  update public.finance_entries set amount = p_amount, due_date = p_due, competence = p_competence,
    description = p_description, notes = p_notes, updated_by = p_actor, updated_at = now() where id = p_entry;
end $$;
create function public.finance_cancel_series(p_entry uuid, p_actor uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare source public.finance_entries; target uuid; total integer := 0;
begin
  select * into source from public.finance_entries where id = p_entry;
  if not found or source.series_id is null then raise exception 'Recorrência não encontrada.'; end if;
  for target in select id from public.finance_entries where series_id = source.series_id and due_date >= source.due_date and not cancelled order by id for update loop
    if not exists(select 1 from public.finance_payments where entry_id = target and not reversed) then
      update public.finance_entries set cancelled = true, updated_by = p_actor, updated_at = now() where id = target;
      total := total + 1;
    end if;
  end loop;
  return total;
end $$;
revoke all on function public.finance_edit(uuid,bigint,date,text,text,text,uuid), public.finance_cancel_series(uuid,uuid) from public, anon, authenticated;
grant execute on function public.finance_edit(uuid,bigint,date,text,text,text,uuid), public.finance_cancel_series(uuid,uuid) to service_role;
