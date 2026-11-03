-- Regra da operação: toda entrada em Pronto para criação vai para Erika.
-- O UUID identifica a pessoa, sem depender de grafia ou homônimos.
-- Não redistribui o estoque existente nem impede reatribuição posterior.
begin;

create or replace function public.assign_creation_to_erika()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  erika_id constant uuid := '8f818af5-4e90-4119-b267-7a19ada8a1be';
  last_index integer;
  changed_at timestamptz := clock_timestamp();
begin
  if new.status <> 'pronto_para_criacao' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = new.status then
      return new;
    end if;
  end if;

  if not exists (select 1 from public.members where id = erika_id and active) then
    raise exception 'Erika Iorrana precisa estar ativa para receber tarefas prontas para criação.';
  end if;
  new.assignee_id := erika_id;
  -- Protege a atribuição da herança automática de editor do pacote.
  new.assignee_source := 'manual';
  new.lists := array['criativa'];

  -- O aplicativo já cria o período novo. Corrige só seu responsável.
  -- Entradas diretas pelo banco também recebem um período consistente.
  new.status_history := coalesce(new.status_history, '[]'::jsonb);
  last_index := jsonb_array_length(new.status_history) - 1;
  if last_index >= 0
    and new.status_history->last_index->>'status' = new.status
    and new.status_history->last_index->>'exitedAt' is null then
    new.status_history := jsonb_set(new.status_history,
      array[last_index::text, 'assigneeId'], to_jsonb(erika_id::text));
  else
    if last_index >= 0 and new.status_history->last_index->>'exitedAt' is null then
      new.status_history := jsonb_set(new.status_history,
        array[last_index::text, 'exitedAt'], to_jsonb(changed_at));
    end if;
    new.status_history := new.status_history || jsonb_build_array(jsonb_build_object(
      'status', new.status, 'enteredAt', changed_at, 'exitedAt', null, 'assigneeId', erika_id));
  end if;
  return new;
end;
$$;

revoke all on function public.assign_creation_to_erika() from public;
grant execute on function public.assign_creation_to_erika() to service_role;

drop trigger if exists task_assign_creation_to_erika on public.tasks;
create trigger task_assign_creation_to_erika
before insert or update of status on public.tasks
for each row execute function public.assign_creation_to_erika();

commit;
