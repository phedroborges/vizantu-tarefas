-- Cargo "agente": login de uma IA (OpenBot) que lê reuniões e cria demandas em
-- rascunho. O que ele enxerga mora em src/lib/permissions.ts: todos os clientes,
-- planos e demandas; nunca senhas, contratos ou financeiro.

alter table members drop constraint if exists members_role_check;
alter table members add constraint members_role_check
  check (role in ('dono', 'gestor', 'social_media', 'diretor_criativo', 'agente'));

alter table announcements drop constraint if exists announcements_scope_role_check;
alter table announcements add constraint announcements_scope_role_check
  check (scope_role in ('dono', 'gestor', 'social_media', 'diretor_criativo', 'agente', 'visualizador'));
