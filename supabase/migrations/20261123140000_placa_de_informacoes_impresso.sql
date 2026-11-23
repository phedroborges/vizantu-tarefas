-- "Placa de Informações" é peça física impressa (ex.: a placa em frente à loja da
-- Casa Caramelo), mas caía no T de "formato desconhecido" e escondia o que era.
-- Passa a ser I, como Impresso. Demanda já numerada mantém o código; a regra vale
-- para as novas e para quem trocar de formato.

create or replace function public.task_format_prefix(format_ids uuid[])
returns text language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select case lower(t.label)
      when 'vídeo' then 'V' when 'reels' then 'V'
      when 'carrossel' then 'C' when 'estático' then 'E' when 'stories' then 'S'
      when 'anúncios' then 'A' when 'impresso' then 'I' when 'placa de informações' then 'I'
      when 'apresentação' then 'AP' when 'contrato' then 'CT'
      when 'direcionamento' then 'D' when 'marca' then 'M'
      when 'moldura' then 'MO' when 'capa do facebook' then 'CP'
      when 'capa de destaque' then 'CP' when 'página do facebook' then 'PG'
      else 'T' end
    from unnest(format_ids) with ordinality f(id, position)
    join public.tags t on t.id=f.id and t.kind='formato'
    order by case when lower(t.label) in ('vídeo','reels','carrossel','estático','stories') then 0 else 1 end, f.position
    limit 1
  ), 'T');
$$;
revoke all on function public.task_format_prefix(uuid[]) from public;
grant execute on function public.task_format_prefix(uuid[]) to service_role;
