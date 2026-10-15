-- Plano mensal.
--
-- Todo mês cada cliente tem um plano próprio, criado sozinho. O plano passa a
-- saber a que mês pertence (period_month, "AAAA-MM"); plano de campanha (Black
-- Friday, lançamento) fica sem mês e nunca é reorganizado por data.

alter table public.plans
  add column if not exists period_month text
    check (period_month ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- Um plano mensal por cliente e mês: é o que permite criar o plano sozinho
-- sem risco de nascerem dois "Plano de Outubro".
create unique index if not exists plans_project_period_month_key
  on public.plans (project_id, period_month) where period_month is not null;

-- Os planos mensais que já existem só tinham o mês no título ("Casa Caramelo |
-- 10/26"). Planos de campanha e de dia ("Carreata | 30/09") ficam sem mês.
update public.plans
set period_month = '20' || substring(title from '/(2\d)\s*$') || '-' || substring(title from '(0[1-9]|1[0-2])/2\d\s*$')
where kind = 'content' and source = 'native' and period_month is null
  and title !~* 'campanha' and title ~ '(0[1-9]|1[0-2])/2\d\s*$';

-- Conteúdo que estava no plano de outro mês vai para o plano do mês da sua data
-- de entrega. O pacote (captação ou criação) acompanha: se o plano de destino
-- ainda não tem um igual, ele é criado com os mesmos responsáveis e a mesma data.
do $$
declare
  t record;
  cap record;
  target uuid;
  new_cap uuid;
  project_name text;
begin
  for t in
    select tk.id, tk.project_id, tk.captacao_id, substr(tk.due_date::text, 1, 7) as m
    from public.tasks tk
    join public.plans pl on pl.id = tk.plan_id
    where pl.period_month is not null and tk.due_date is not null
      and substr(tk.due_date::text, 1, 7) <> pl.period_month
  loop
    select id into target from public.plans where project_id = t.project_id and period_month = t.m;
    if target is null then
      select name into project_name from public.projects where id = t.project_id;
      insert into public.plans (project_id, title, kind, status, source, period_month)
      values (t.project_id, project_name || ' | ' || substr(t.m, 6, 2) || '/' || substr(t.m, 3, 2), 'content', 'draft', 'native', t.m)
      returning id into target;
    end if;

    new_cap := null;
    if t.captacao_id is not null then
      select * into cap from public.plan_captacoes where id = t.captacao_id;
      select id into new_cap from public.plan_captacoes
        where plan_id = target and label = cap.label and package_kind = cap.package_kind;
      if new_cap is null then
        insert into public.plan_captacoes (plan_id, label, sequence_order, package_kind, recording_assignee_id, editing_assignee_id)
        values (target, cap.label, cap.sequence_order, cap.package_kind, cap.recording_assignee_id, cap.editing_assignee_id)
        returning id into new_cap;
        insert into public.plan_events (project_id, title, event_type, event_date)
        select project_id, title, split_part(event_type, ':', 1) || ':' || new_cap, event_date
        from public.plan_events
        where event_type in ('captacao:' || cap.id, 'producao:' || cap.id)
        limit 1;
      end if;
    end if;

    update public.tasks set plan_id = target, captacao_id = new_cap where id = t.id;
  end loop;
end $$;
