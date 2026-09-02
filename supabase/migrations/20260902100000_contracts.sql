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

-- Como o dinheiro é cobrado, separado de QUANDO é cobrado (payment_mode).
-- São eixos independentes: um contrato escalonado pode ser pré ou pós-pago do
-- mesmo jeito que um de mensalidade fixa.
--
-- 'escalonado' existe porque contrato de degrau ("3 meses a 2 mil, 3 a 2500,
-- 6 a 3 mil") não cabe num campo de valor mensal só. O total, a vigência e a
-- tabela de faixas passam a sair das faixas, não da digitação.
alter table contracts add column if not exists payment_structure text not null default 'mensal';
alter table contracts drop constraint if exists contracts_payment_structure_check;
alter table contracts
  add constraint contracts_payment_structure_check check (payment_structure in ('mensal', 'escalonado', 'projeto'));

update contracts set payment_structure = 'projeto' where template_id = 'criacao_marca';
