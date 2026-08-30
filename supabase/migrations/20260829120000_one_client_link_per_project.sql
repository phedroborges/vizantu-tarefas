-- Um link de aprovação por projeto, garantido pelo banco.
--
-- Até 18/08/2026 o botão "gerar link" chamava createClientLink direto, sem
-- revogar o anterior: cada clique emitia um endereço novo e todos continuavam
-- válidos. O projeto "Campanha do Dr Lourival" acumulou 6 endereços vivos
-- assim. O código já reaproveita o link ativo desde então, mas nada no banco
-- impedia a volta do problema — e a identidade de quem aprova não vem do link
-- (o cliente se identifica na hora da aprovação, ver reviewerName), então
-- nunca houve motivo pra existir mais de um.

-- Mantém, por projeto, o link mais recentemente usado (e, no empate, o mais
-- recente criado); revoga os demais.
with ranked as (
  select id,
         row_number() over (
           partition by project_id
           order by last_used_at desc nulls last, created_at desc
         ) as posicao
  from client_links
  where revoked_at is null
)
update client_links
set revoked_at = now()
where id in (select id from ranked where posicao > 1);

create unique index if not exists client_links_one_active_per_project
  on client_links(project_id)
  where revoked_at is null;
