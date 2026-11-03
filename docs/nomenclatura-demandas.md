# Nomenclatura obrigatória das demandas

Toda demanda recebe `SIGLA + número · Título`, por exemplo `V1 · Como emitir sua primeira nota`.
A regra vale para todos os clientes, planos, status e criadores: equipe, IA, importação ou integração.

| Formato | Sigla |
|---|---|
| Vídeo ou Reels | V |
| Carrossel | C |
| Estático | E |
| Stories | S |
| Anúncios sem formato físico definido | A |
| Impresso | I |
| Apresentação | AP |
| Contrato | CT |
| Direcionamento | D |
| Marca | M |
| Moldura | MO |
| Capa do Facebook ou de destaque | CP |
| Página do Facebook | PG |
| Interno, formato desconhecido ou ausente | T |

## Sequência e edição

- A sequência começa em 1 para cada sigla dentro de cada plano. Não reinicia por pacote de captação.
- Anúncio em vídeo usa V; anúncio estático usa E. A palavra “Anúncio” continua no título para identificar a finalidade.
- Com vários formatos, vídeo/Reels/carrossel/estático/Stories têm prioridade; entre eles vale o primeiro formato cadastrado.
- O banco acrescenta e corrige o código automaticamente. O cliente da API deve usar o nome retornado pelo servidor.
- A IA deve informar o título descritivo e o formato correto; não calcular números por conta própria nem duplicar códigos.
- Sem evidência do formato, manter T e indicar a informação pendente; não inventar um formato com base no tema.
- Renomear, mudar prazo, status ou responsável mantém o número. Não renumerar para ordenar o calendário.
- Trocar formato para outra sigla ou transferir para outro plano aloca o próximo número do destino.
- Duplicar uma tarefa gera outro código. Excluir não reutiliza números. Lacunas são normais.
- A sequência é atômica no banco para evitar colisões entre pessoas criando ao mesmo tempo.

## Aplicação aos registros existentes

Todos os registros existentes recebem o padrão, inclusive finalizados e planos antigos.
Na implantação, códigos já padronizados vêm primeiro; os demais seguem prazo, criação e ID.
Os títulos anteriores ficam no histórico. IDs, textos, prazos, responsáveis e status são preservados.

Implementação: `supabase/migrations/20261103205305_task_naming_standard.sql`.
Os campos `naming_prefix` e `naming_number` pertencem à automação, não à edição manual.
