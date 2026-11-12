# Onboard do cliente

Cada projeto tem a aba **Onboard**, logo depois de Informações. É o checklist padrão da Vizantu para colocar um cliente no fluxo: briefing, Meta, Google Meu Negócio, site, WhatsApp e Tintim, mensagens de gatilho, CRM, ERP, acessos, Zernio com o Claude Code, segurança e fechamento.

## Como funciona

- A lista de itens mora em `src/lib/onboarding/checklist.ts`. Para mudar o processo, edite ali.
- O id de cada item é uma chave escrita à mão (`meta.pagina`). Não renumere nem reaproveite uma chave para outro item: o que já foi marcado fica guardado por ela.
- A ficha no topo (tem site, CRM, ERP) decide quais itens valem. Item que não vale não entra no progresso. Sem resposta, o cliente conta como quem tem site.
- Marcar salva na hora, uma marcação por pedido, com a data do dia. Quem mantém o cliente (cargos que planejam) lê e marca; o diretor criativo não vê a aba.

## Antes de publicar

O deploy não executa migrations. Aplique no Supabase da VPS, no SQL Editor ou pelo fluxo de migrations da instalação:

`supabase/migrations/20261112120000_project_onboarding.sql`

Sem a tabela `project_onboarding`, a aba abre com a mensagem "A tabela project_onboarding ainda não existe no banco".
