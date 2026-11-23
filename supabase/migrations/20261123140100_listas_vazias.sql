-- Seis demandas (cinco de 05/08/2026 e uma de 02/11/2026) estavam sem lista,
-- provavelmente criadas direto no banco. Sem lista, somem para quem tem acesso
-- por lista e para os agentes. A lista sai do status, como o app faz em
-- deriveListsForStatus: não iniciada vai para a estratégica, o resto para a criativa.

update tasks
set lists = case
  when status in ('rascunho', 'aguardando_informacao', 'aprovacao_copy', 'aguardando_captacao') then array['estrategica']
  else array['criativa']
end
where coalesce(array_length(lists, 1), 0) = 0;
