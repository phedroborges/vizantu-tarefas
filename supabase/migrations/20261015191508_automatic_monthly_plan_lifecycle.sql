-- Sem depender do navegador: tarefas recebem um plano na mesma transação.
-- Meses encerrados são derivados do calendário em São Paulo, sem alterar
-- status de produção nem apagar histórico de aprovação.
create or replace function public.ensure_monthly_plan(p_project uuid, p_month text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  insert into public.plans (project_id, title, kind, status, source, period_month)
  select id, name || ' | ' || substr(p_month, 6, 2) || '/' || substr(p_month, 3, 2),
    'content', 'draft', 'native', p_month from public.projects where id = p_project
  on conflict (project_id, period_month) where period_month is not null do nothing;
  select id into strict result from public.plans where project_id = p_project and period_month = p_month;
  return result;
end $$;

-- Pacote pronto e seus conteúdos nascem juntos: uma falha desfaz tudo.
create or replace function public.create_ready_package(
  p_plan uuid, p_label text, p_kind text, p_count integer, p_format uuid,
  p_editor uuid default null, p_recorder uuid default null, p_actor uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare target public.plans; package_id uuid; format_name text; created timestamptz := now();
begin
  select * into strict target from public.plans where id = p_plan;
  if target.kind <> 'content' or target.status in ('archived', 'completed')
    or target.period_month < to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') then
    raise exception 'Escolha um plano de conteúdo em andamento.';
  end if;
  if p_count < 1 or p_count > 30 or p_kind not in ('capture', 'creation') or length(trim(p_label)) = 0 then
    raise exception 'Pacote inválido.';
  end if;
  select label into strict format_name from public.tags where id = p_format and kind = 'formato';
  insert into public.plan_captacoes (plan_id, label, package_kind, sequence_order, editing_assignee_id, recording_assignee_id)
  values (p_plan, trim(p_label), p_kind,
    (select coalesce(max(sequence_order), -1) + 1 from public.plan_captacoes where plan_id = p_plan),
    p_editor, case when p_kind = 'capture' then p_recorder else null end) returning id into package_id;
  insert into public.tasks (project_id, plan_id, captacao_id, name, kind, status, lists,
    format_tag_ids, assignee_id, assignee_source, sequence_order, status_history, comments, created_at, updated_at)
  select target.project_id, p_plan, package_id, format_name || ' ' || n || ' · ' || trim(p_label),
    'conteudo', 'rascunho', array['estrategica'], array[p_format], p_editor, 'captacao', n - 1,
    jsonb_build_array(jsonb_build_object('status', 'rascunho', 'enteredAt', created, 'exitedAt', null, 'assigneeId', p_editor)),
    case when p_actor is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'author', 'Sistema', 'authorMemberId', p_actor, 'text', '', 'createdAt', created,
      'kind', 'activity', 'fieldKey', 'created', 'oldValue', null, 'newValue', format_name || ' ' || n || ' · ' || trim(p_label))) end,
    created, created from generate_series(1, p_count) n;
  return package_id;
end $$;
revoke all on function public.create_ready_package(uuid, text, text, integer, uuid, uuid, uuid, uuid) from public;
grant execute on function public.create_ready_package(uuid, text, text, integer, uuid, uuid, uuid, uuid) to service_role;
revoke all on function public.ensure_monthly_plan(uuid, text) from public;
grant execute on function public.ensure_monthly_plan(uuid, text) to service_role;

-- Legado sem plano: preserva o mês da criação, não ressuscita tarefas antigas.
-- Um pacote já escolhido tem precedência sobre o padrão mensal.
update public.tasks t set plan_id = c.plan_id
from public.plan_captacoes c join public.plans p on p.id = c.plan_id
where t.plan_id is null and t.captacao_id = c.id and t.project_id = p.project_id;
do $$
declare item record; target uuid;
begin
  for item in select distinct project_id,
    to_char(created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') as month
    from public.tasks where plan_id is null
  loop
    target := public.ensure_monthly_plan(item.project_id, item.month);
    update public.tasks set plan_id = target, captacao_id = null
    where project_id = item.project_id and plan_id is null
      and to_char(created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') = item.month;
  end loop;
end $$;

create or replace function public.assign_task_plan()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target public.plans; current_month text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
begin
  if new.plan_id is null then
    new.plan_id := public.ensure_monthly_plan(new.project_id, current_month);
  end if;
  select * into strict target from public.plans where id = new.plan_id;
  if target.project_id <> new.project_id then
    raise exception 'O plano precisa pertencer ao cliente da tarefa.';
  end if;
  if tg_op = 'INSERT' or new.plan_id is distinct from old.plan_id then
    if target.period_month < current_month or target.status in ('archived', 'completed') then
      raise exception 'Este plano está encerrado. Escolha um plano em andamento.';
    end if;
  end if;
  if new.captacao_id is not null and not exists (
    select 1 from public.plan_captacoes where id = new.captacao_id and plan_id = new.plan_id
  ) then
    raise exception 'O pacote precisa pertencer ao plano da tarefa.';
  end if;
  return new;
end $$;
revoke all on function public.assign_task_plan() from public;
create trigger task_requires_plan before insert or update of plan_id, project_id, captacao_id
  on public.tasks for each row execute function public.assign_task_plan();
alter table public.tasks alter column plan_id set not null;

create or replace function public.create_project_months()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  for month_offset in 0..2 loop
    perform public.ensure_monthly_plan(new.id, to_char(
      (now() at time zone 'America/Sao_Paulo') + make_interval(months => month_offset), 'YYYY-MM'));
  end loop;
  return new;
end $$;
revoke all on function public.create_project_months() from public;
create trigger project_monthly_plans after insert on public.projects
  for each row execute function public.create_project_months();

do $$
declare p record;
begin
  for p in select id from public.projects where status = 'ativo' loop
    for month_offset in 0..2 loop
      perform public.ensure_monthly_plan(p.id, to_char(
        (now() at time zone 'America/Sao_Paulo') + make_interval(months => month_offset), 'YYYY-MM'));
    end loop;
  end loop;
end $$;
