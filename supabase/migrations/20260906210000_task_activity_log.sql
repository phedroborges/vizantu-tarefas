create table if not exists task_activity_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  actor_member_id uuid references members(id) on delete set null,
  field_key text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists task_activity_events_task_created_idx
  on task_activity_events(task_id, created_at desc);

alter table task_activity_events enable row level security;

-- A trilha é lida e gravada apenas pelo servidor com service role.
-- Mesmo que public seja exposto pela Data API, usuários não acessam a tabela diretamente.
revoke all on table task_activity_events from anon, authenticated;
