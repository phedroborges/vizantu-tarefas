-- A régua de cobrança e o aviso de fim de contrato são internos: notificam o
-- dono dentro do app, nunca o cliente. O plano do cliente é aberto por link, e
-- qualquer número financeiro ali vazaria para quem tiver o endereço.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('mention', 'task_assigned', 'task_overdue', 'announcement', 'finance_receivable', 'contract_ending'));
