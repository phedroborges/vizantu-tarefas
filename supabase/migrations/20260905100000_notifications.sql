create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_member_id uuid not null references members(id) on delete cascade,
  actor_member_id uuid references members(id) on delete set null,
  type text not null check (type in ('mention', 'task_assigned', 'task_overdue', 'announcement')),
  task_id uuid references tasks(id) on delete cascade,
  title text not null,
  body text not null default '',
  action_url text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx on notifications(recipient_member_id, created_at desc);
create index if not exists notifications_recipient_unread_idx on notifications(recipient_member_id, read_at) where read_at is null;
create unique index if not exists notifications_dedupe_key_idx on notifications(dedupe_key) where dedupe_key is not null;
alter table notifications enable row level security;

-- O app acessa esta tabela somente pelo servidor com service role. RLS fica
-- como defesa adicional caso a tabela seja exposta pela Data API no futuro.
revoke all on table notifications from anon, authenticated;
