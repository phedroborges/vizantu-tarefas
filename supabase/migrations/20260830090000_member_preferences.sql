-- Preferências de exibição por pessoa: como CADA UMA gosta de ver o app
-- (lista ou calendário, colunas visíveis, formato de data, mostrar finalizadas).
--
-- Antes isso morava no localStorage, ou seja, no navegador: trocar de máquina,
-- limpar o cache ou abrir numa janela anônima zerava tudo, e a preferência não
-- seguia a conta. Agora é do membro.
--
-- As cores dos status continuam FORA daqui, em status_colors, valendo pro time
-- inteiro: cor é código visual compartilhado, não gosto de quem olha.

create table if not exists member_preferences (
  member_id uuid primary key references members(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table member_preferences enable row level security;
