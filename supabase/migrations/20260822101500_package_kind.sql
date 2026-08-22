alter table plan_captacoes
  add column if not exists package_kind text not null default 'creation';

alter table plan_captacoes
  drop constraint if exists plan_captacoes_package_kind_check;

alter table plan_captacoes
  add constraint plan_captacoes_package_kind_check
  check (package_kind in ('capture', 'creation'));

update plan_captacoes as package
set package_kind = case
  when exists (
    select 1
    from tasks
    join tags on tags.id = any(tasks.format_tag_ids)
    where tasks.captacao_id = package.id
      and tags.kind = 'formato'
      and lower(trim(tags.label)) in ('vídeo', 'video', 'reel', 'reels')
  ) then 'capture'
  else 'creation'
end;
