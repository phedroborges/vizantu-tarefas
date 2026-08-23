alter table plans drop constraint if exists plans_kind_check;

alter table plans
  add constraint plans_kind_check
  check (kind in ('content', 'process', 'presentation', 'brand'));
