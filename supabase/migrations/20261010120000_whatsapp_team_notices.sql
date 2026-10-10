-- Avisos da equipe pelo WhatsApp.
--
-- O grupo do time passa a receber avisos internos (atrasadas, demandas sem
-- informação, o mais rápido na criação). Eles usam a mesma fila dos avisos de
-- cliente, com um tipo próprio, e não pertencem a projeto nenhum
-- (project_id fica nulo, o que a tabela já permite).

alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_kind_check;
alter table public.whatsapp_messages add constraint whatsapp_messages_kind_check
  check (kind in ('approval', 'reminder', 'last_day', 'auto_approved', 'broadcast', 'team'));
