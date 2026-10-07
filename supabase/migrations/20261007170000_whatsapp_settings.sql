-- Configuração geral das mensagens automáticas do WhatsApp: o interruptor que
-- liga os avisos de aprovação, a hora em que saem, o intervalo dos lembretes e
-- o texto de cada tipo de mensagem. Uma linha só (id = 1).
--
-- O interruptor nasce desligado: nenhum aviso sai para cliente antes de alguém
-- revisar os textos e ligar.

create table if not exists public.whatsapp_settings (
  id integer primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_settings enable row level security;
