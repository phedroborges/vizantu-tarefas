-- Comentário entra somando à lista dentro do banco. O app lia a lista inteira,
-- acrescentava um item e regravava tudo: dois comentários ao mesmo tempo (o
-- cliente pedindo ajuste enquanto alguém do time escreve) apagavam um ao outro.
create or replace function public.append_task_comments(p_task_id uuid, p_comments jsonb)
returns setof public.tasks
language sql
as $$
  update public.tasks
     set comments = coalesce(comments, '[]'::jsonb) || p_comments,
         updated_at = now()
   where id = p_task_id
  returning *;
$$;

revoke all on function public.append_task_comments(uuid, jsonb) from public;
grant execute on function public.append_task_comments(uuid, jsonb) to service_role;

-- Conversa do assistente é de quem a abriu. Sem dono, toda pessoa com IA lia
-- as conversas de todo mundo, inclusive as do financeiro e dos contratos.
-- As antigas ficam com o dono da conta, que já via tudo.
alter table public.assistant_conversations
  add column if not exists member_id uuid references public.members(id) on delete cascade;

update public.assistant_conversations
   set member_id = (select id from public.members where role = 'dono' order by created_at limit 1)
 where member_id is null;

create index if not exists assistant_conversations_member_id_idx on public.assistant_conversations(member_id, updated_at desc);
