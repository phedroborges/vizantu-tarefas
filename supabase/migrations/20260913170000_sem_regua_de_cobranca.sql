-- Vencimento, atraso e cobrança são do Asaas, que é onde o dinheiro circula.
-- Duplicar isso aqui criaria uma segunda versão da verdade, sempre atrasada.
-- O tipo de notificação de cobrança sai; o de fim de contrato fica, porque esse
-- o Asaas não sabe: é quando a relação acaba, não quando a parcela vence.
delete from public.notifications where type = 'finance_receivable';
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('mention', 'task_assigned', 'task_overdue', 'announcement', 'contract_ending'));
