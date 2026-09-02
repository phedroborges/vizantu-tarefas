-- Contratos: os modelos da casa preenchidos com os dados do cliente novo.
--
-- O texto das cláusulas fica COPIADO em cada contrato (coluna body), não
-- referenciado por um id de modelo. É de propósito: contrato assinado não pode
-- mudar de conteúdo porque alguém melhorou o modelo depois. O modelo é o ponto
-- de partida; a partir da criação, cada contrato é um documento próprio.
--
-- fields guarda só o que varia de cliente pra cliente (razão social, CNPJ,
-- endereço, valor, vigência). O que dá pra calcular a partir disso (total,
-- valor por extenso, data final da vigência) não é salvo: é derivado na hora
-- de renderizar, senão um dado desatualiza o outro.
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  title text not null,
  template_id text not null,
  payment_mode text not null default 'pre' check (payment_mode in ('pre', 'pos')),
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'assinado', 'encerrado')),
  fields jsonb not null default '{}',
  body text not null default '',
  created_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contracts_project_id_idx on contracts(project_id);
alter table contracts enable row level security;
