begin;

alter table public.tasks add column naming_prefix text;
alter table public.tasks add column naming_number integer check (naming_number > 0);

create table public.task_naming_counters (
  plan_id uuid not null references public.plans(id) on delete cascade,
  prefix text not null,
  last_number integer not null check (last_number > 0),
  primary key (plan_id, prefix)
);
alter table public.task_naming_counters enable row level security;
revoke all on public.task_naming_counters from public, anon, authenticated;
grant all on public.task_naming_counters to service_role;

create function public.task_format_prefix(format_ids uuid[])
returns text language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select case lower(t.label)
      when 'vídeo' then 'V' when 'reels' then 'V'
      when 'carrossel' then 'C' when 'estático' then 'E' when 'stories' then 'S'
      when 'anúncios' then 'A' when 'impresso' then 'I'
      when 'apresentação' then 'AP' when 'contrato' then 'CT'
      when 'direcionamento' then 'D' when 'marca' then 'M'
      when 'moldura' then 'MO' when 'capa do facebook' then 'CP'
      when 'capa de destaque' then 'CP' when 'página do facebook' then 'PG'
      else 'T' end
    from unnest(format_ids) with ordinality f(id, position)
    join public.tags t on t.id=f.id and t.kind='formato'
    order by case when lower(t.label) in ('vídeo','reels','carrossel','estático','stories') then 0 else 1 end, f.position
    limit 1
  ), 'T');
$$;
revoke all on function public.task_format_prefix(uuid[]) from public;
grant execute on function public.task_format_prefix(uuid[]) to service_role;

create function public.normalize_task_name()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  desired_prefix text := public.task_format_prefix(new.format_tag_ids);
  body text;
  needs_number boolean := true;
begin
  if tg_op = 'UPDATE' then
    needs_number := old.naming_number is null or old.plan_id is distinct from new.plan_id
      or old.naming_prefix is distinct from desired_prefix;
    if not needs_number then
      new.naming_number := old.naming_number;
    end if;
  end if;
  if needs_number then
    insert into public.task_naming_counters as counters(plan_id,prefix,last_number)
    values (new.plan_id,desired_prefix,1)
    on conflict (plan_id,prefix) do update set last_number=counters.last_number+1
    returning last_number into new.naming_number;
  end if;
  new.naming_prefix := desired_prefix;
  -- Aceita códigos digitados, mas a sequência oficial é sempre do banco.
  body := btrim(regexp_replace(btrim(new.name),
    '^((AP|CT|CP|PG|MO|V|C|E|S|A|I|D|M|T)[0-9]+[[:space:]]*[·:–—-][[:space:]]*)+', '', 'i'));
  if body = '' then
    raise exception 'Informe o título da demanda além do código.';
  end if;
  new.name := desired_prefix || new.naming_number || ' · ' || body;
  return new;
end;
$$;
revoke all on function public.normalize_task_name() from public;
grant execute on function public.normalize_task_name() to service_role;

-- Pela ordem alfabética dos BEFORE triggers, task_requires_plan resolve
-- o plano primeiro, inclusive quando o chamador não informou plan_id.
create trigger zz_task_naming before insert or update of name,format_tag_ids,plan_id,project_id,naming_prefix,naming_number
on public.tasks for each row execute function public.normalize_task_name();

-- Os códigos existentes vêm primeiro, preservando V1/C1/E1 da Parceria.
-- Os demais seguem prazo, criação e ID. Não altera status/prazo/responsável.
do $$
declare item record;
begin
  for item in
    select id from public.tasks
    order by plan_id, public.task_format_prefix(format_tag_ids),
      case when name ~ ('^' || public.task_format_prefix(format_tag_ids) || '[0-9]+[[:space:]]*[·:–—-]') then 0 else 1 end,
      substring(name from '^[A-Z]+([0-9]+)[[:space:]]*[·:–—-]')::integer nulls last,
      due_date nulls last, created_at, id
  loop
    update public.tasks set
      comments=comments || jsonb_build_array(jsonb_build_object(
        'id',gen_random_uuid(),'author','Sistema','kind','activity','fieldKey','name',
        'oldValue',name,'text','Padronização automática da nomenclatura solicitada por Phedro.',
        'createdAt',now())),
      name=name
    where id=item.id;
  end loop;
end;
$$;

alter table public.tasks alter column naming_prefix set not null;
alter table public.tasks alter column naming_number set not null;
create unique index tasks_naming_unique on public.tasks(plan_id,naming_prefix,naming_number);
commit;
