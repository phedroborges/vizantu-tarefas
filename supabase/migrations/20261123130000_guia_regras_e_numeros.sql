-- Bloco "Regras e números" do guia do cliente (ver CLIENT_GUIDE_BLOCKS em
-- src/lib/client-guide.ts). É o que o tráfego e a criação não podem errar e o
-- que o agente de tráfego lê antes de analisar uma campanha.

alter table project_profiles
  add column if not exists metas text,
  add column if not exists verba_anuncio text,
  add column if not exists regiao_publico text,
  add column if not exists chamada_para_acao text,
  add column if not exists nao_pode_falar text,
  add column if not exists contas_ferramentas text;
