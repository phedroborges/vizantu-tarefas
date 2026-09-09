-- Cargos da operação no lugar de graus genéricos de permissão.
--
-- "editor" não dizia nada sobre o que a pessoa faz aqui dentro, e por isso todo
-- mundo que não era dono acabava podendo quase tudo. Os cargos novos são as
-- funções que existem de verdade no time, e o que cada uma enxerga sai daí
-- (a regra em si mora em src/lib/permissions.ts).
--
-- Migração intencionalmente conservadora: quem era editor vira social_media,
-- que é um subconjunto estrito do que editor já podia. Ninguém ganha acesso
-- novo pela migração — o dono ajusta cada pessoa na tela de Membros depois.

alter table members drop constraint if exists members_role_check;
update members set role = 'social_media' where role in ('editor', 'visualizador');
alter table members add constraint members_role_check
  check (role in ('dono', 'gestor', 'social_media', 'diretor_criativo'));
alter table members alter column role set default 'social_media';

-- Avisos antigos podem apontar para um cargo que deixou de existir. Manter
-- 'visualizador' aceito aqui preserva exatamente o efeito que esses avisos já
-- tinham: alcançar ninguém. Reapontá-los para um cargo vivo faria um aviso
-- velho ressurgir na tela de quem nunca o viu.
alter table announcements drop constraint if exists announcements_scope_role_check;
alter table announcements add constraint announcements_scope_role_check
  check (scope_role in ('dono', 'gestor', 'social_media', 'diretor_criativo', 'visualizador'));

-- project_access deixa de ser "o que este visualizador pode ver" e passa a ser
-- "quem trabalha neste cliente", lido pelos dois lados. Projeto sem nenhuma
-- linha aqui continua visível para o time inteiro — é o que permite ligar o
-- escopo sem apagar a tela de quem ainda não foi colocado em equipe nenhuma.
comment on table project_access is
  'Equipe de cada cliente. Sem linhas para um projeto = aberto a todo o time. Dono e gestor enxergam todos os projetos independentemente desta tabela.';
