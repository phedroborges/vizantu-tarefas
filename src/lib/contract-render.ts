// Preenche o contrato com os dados do cliente.
//
// Duas regras mandam aqui. A primeira: o que dá pra calcular NÃO é campo. O
// total é mensal vezes meses, o extenso sai do número, a data final sai do
// início mais a vigência. Digitar isso à mão é criar chance de um dado
// contradizer o outro dentro do mesmo contrato.
//
// A segunda: campo não preenchido nunca vira texto vazio. Ele aparece marcado
// na prévia e some do contador de pendências só depois de preenchido. Um
// contrato que sai com um buraco silencioso no lugar do valor é pior que um
// contrato que não sai.

import { CONTRACT_FIELD_BY_KEY, type PaymentStructure } from "./contract-templates";
import { formatarReais, reaisPorExtenso } from "./numero-extenso";

export type ContractFields = Record<string, string>;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

function numero(fields: ContractFields, key: string): number {
  // Aceita "2.797,00" e "2797" — é o mesmo valor, e ninguém deveria ter que
  // lembrar de qual formato o campo espera.
  const raw = (fields[key] || "").trim().replace(/[^\d,.-]/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replaceAll(".", "").replace(",", ".") : raw;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

// "2026-09-01" vira "01 de setembro de 2026", que é como o contrato escreve.
export function dataPorExtenso(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  if (!match) return "";
  const [, ano, mes, dia] = match;
  const nome = MESES[Number(mes) - 1];
  return nome ? `${dia} de ${nome} de ${ano}` : "";
}

function somarMeses(iso: string, meses: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  if (!match || !meses) return "";
  const [, ano, mes, dia] = match;
  const base = new Date(Date.UTC(Number(ano), Number(mes) - 1 + meses, Number(dia)));
  return base.toISOString().slice(0, 10);
}

// O primeiro vencimento é uma data que ninguém deveria digitar: ela sai do
// início da vigência e do dia combinado. No pré-pago vence antes do mês de
// execução, no pós-pago vence dentro dele.
function primeiroVencimento(fields: ContractFields, paymentMode: "pre" | "pos"): string {
  const inicio = (fields.vigencia_inicio || "").trim();
  const dia = Math.min(Math.max(Math.trunc(numero(fields, "dia_vencimento")) || 0, 1), 28);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inicio);
  if (!match || !dia) return "";
  const [, ano, mes] = match;
  const deslocamento = paymentMode === "pre" ? -1 : 0;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1 + deslocamento, dia));
  return dataPorExtenso(data.toISOString().slice(0, 10));
}

// A qualificação da CONTRATANTE muda de forma conforme o que foi preenchido:
// pessoa jurídica com representante lê diferente de pessoa física. Montar isso
// como uma frase só evita o contrato com "neste ato representada por ," no
// meio.
function qualificacao(fields: ContractFields): string {
  const documento = (fields.contratante_documento || "").trim();
  const endereco = (fields.contratante_endereco || "").trim().replace(/\s*\n\s*/g, ", ");
  const email = (fields.contratante_email || "").trim().split("\n").map((linha) => linha.trim()).filter(Boolean).join(" / ");
  const representante = (fields.contratante_representante || "").trim();
  const cpfRepresentante = (fields.contratante_representante_cpf || "").trim();

  const digitos = documento.replace(/\D/g, "").length;
  const tipo = digitos === 11 ? "CPF" : "CNPJ";

  const partes: string[] = [];
  if (documento) partes.push(`inscrita no ${tipo} sob o nº ${documento}`);
  if (endereco) partes.push(`com endereço na ${endereco}`);
  if (email) partes.push(`e-mail ${email}`);
  if (representante) {
    partes.push(
      cpfRepresentante
        ? `neste ato representada por ${representante}, inscrito no CPF sob o nº ${cpfRepresentante}`
        : `neste ato representada por ${representante}`,
    );
  }
  return partes.join(", ");
}

export type Faixa = { meses: number; valor: number };

// As faixas são escritas como "3 x 2000", uma por linha. Texto em vez de JSON
// porque o campo é editado por gente (e pela IA), e "3 x 2000" é legível dos
// dois lados. O separador aceita x, × ou "meses" no meio, porque é o que sai
// naturalmente de quem digita rápido.
export function parseFaixas(raw: string | undefined): Faixa[] {
  const faixas: Faixa[] = [];
  for (const linha of (raw || "").split("\n")) {
    const match = /^\s*(\d+)\s*(?:x|×|mes(?:es)?\s*x?)\s*R?\$?\s*([\d.,]+)/i.exec(linha);
    if (!match) continue;
    const meses = Number(match[1]);
    const bruto = match[2];
    const valor = Number(bruto.includes(",") ? bruto.replaceAll(".", "").replace(",", ".") : bruto);
    if (meses > 0 && Number.isFinite(valor) && valor > 0) faixas.push({ meses, valor });
  }
  return faixas;
}

export function formatFaixas(faixas: Faixa[]): string {
  return faixas.map((faixa) => `${faixa.meses} x ${faixa.valor}`).join("\n");
}

// "do 1º ao 3º mês", ou "no 1º mês" quando a faixa dura um mês só. É o texto
// que entra na tabela dentro da cláusula de pagamento.
export function tabelaEscalonamento(faixas: Faixa[]): string {
  let mes = 1;
  return faixas
    .map((faixa) => {
      const fim = mes + faixa.meses - 1;
      const intervalo = mes === fim ? `no ${mes}º mês` : `do ${mes}º ao ${fim}º mês`;
      const linha = `- ${intervalo}: R$ ${formatarReais(faixa.valor)} (${reaisPorExtenso(faixa.valor)}) por mês`;
      mes = fim + 1;
      return linha;
    })
    .join("\n");
}

// Tudo que o texto pode pedir e não é digitado.
export function derivedFields(
  fields: ContractFields,
  paymentMode: "pre" | "pos",
  structure: PaymentStructure = "mensal",
): ContractFields {
  const mensal = numero(fields, "valor_mensal");
  const parcelas = Math.trunc(numero(fields, "parcelas")) || 0;
  const verba = numero(fields, "verba_minima");
  const faixas = structure === "escalonado" ? parseFaixas(fields.escalonamento) : [];

  // No contrato escalonado a vigência e o total são a SOMA das faixas, nunca
  // campos digitados. Um degrau a mais muda os dois de uma vez, e deixar
  // alguém redigitar é criar a chance de o contrato dizer 12 meses numa
  // cláusula e 9 na outra.
  const meses = faixas.length
    ? faixas.reduce((soma, faixa) => soma + faixa.meses, 0)
    : Math.trunc(numero(fields, "vigencia_meses")) || 0;
  // No mensal o total vem da mensalidade. No de projeto quem manda é o valor
  // digitado no campo de valor (é o mesmo campo, com outro papel), e a parcela
  // é que sai da divisão.
  const total = faixas.length
    ? faixas.reduce((soma, faixa) => soma + faixa.meses * faixa.valor, 0)
    : meses ? mensal * meses : mensal;
  const parcela = parcelas ? total / parcelas : 0;
  const inicio = (fields.vigencia_inicio || "").trim();
  const fim = somarMeses(inicio, meses);

  const derived: ContractFields = {
    contratante_qualificacao: qualificacao(fields),
    vigencia_inicio_extenso: dataPorExtenso(inicio),
    vigencia_fim_extenso: dataPorExtenso(fim),
    vigencia_fim: fim,
    data_assinatura_extenso: dataPorExtenso(fields.data_assinatura || ""),
    primeiro_vencimento: primeiroVencimento(fields, paymentMode),
    vigencia_meses: meses ? String(meses) : "",
    qtd_total_conteudos: String(
      Math.trunc(numero(fields, "qtd_estaticos")) + Math.trunc(numero(fields, "qtd_carrosseis")) + Math.trunc(numero(fields, "qtd_videos")),
    ),
  };

  if (faixas.length) derived.tabela_escalonamento = tabelaEscalonamento(faixas);
  if (total) {
    derived.valor_total_formatado = formatarReais(total);
    derived.valor_total_extenso = reaisPorExtenso(total);
  }
  if (mensal) {
    derived.valor_mensal_formatado = formatarReais(mensal);
    derived.valor_mensal_extenso = reaisPorExtenso(mensal);
  }
  if (parcela) {
    derived.valor_parcela_formatado = formatarReais(parcela);
    derived.valor_parcela_extenso = reaisPorExtenso(parcela);
  }
  if (verba) {
    derived.verba_minima_formatada = formatarReais(verba);
    derived.verba_minima_extenso = reaisPorExtenso(verba);
  }

  // Lista de e-mails numa linha só, do jeito que a cláusula lê.
  const emails = (fields.emails_vizantu || "").split("\n").map((linha) => linha.trim()).filter(Boolean);
  if (emails.length) derived.emails_vizantu = emails.join(" / ");

  return derived;
}

// Como cada buraco do documento se chama em português. Sem este mapa, o
// contrato saía com «vigencia_inicio_extenso» escrito no meio da cláusula: o
// nome da variável, não o nome da coisa. Quem lê a marca precisa entender o
// que está faltando sem conhecer o código.
const DERIVED_LABELS: Record<string, string> = {
  vigencia_inicio_extenso: "Início da vigência",
  vigencia_fim_extenso: "Fim da vigência",
  data_assinatura_extenso: "Data de assinatura",
  primeiro_vencimento: "Primeiro vencimento",
  valor_mensal_formatado: "Valor mensal",
  valor_mensal_extenso: "Valor mensal",
  valor_total_formatado: "Valor total",
  valor_total_extenso: "Valor total",
  valor_parcela_formatado: "Valor da parcela",
  valor_parcela_extenso: "Valor da parcela",
  verba_minima_formatada: "Verba mínima de tráfego",
  verba_minima_extenso: "Verba mínima de tráfego",
  tabela_escalonamento: "Faixas de valor",
  contratante_qualificacao: "Dados do cliente",
  qtd_total_conteudos: "Quantidades do mês",
  local_data: "Cidade e data da assinatura",
};

// De quais CAMPOS cada buraco derivado depende.
//
// Este mapa é o que liga o texto ao formulário, e ele já foi a origem de um
// bug feio: o formulário só mostrava campo cujo nome aparecia LITERALMENTE no
// contrato, e o endereço, o e-mail e o valor mensal nunca aparecem — o texto
// pede {{contratante_qualificacao}} e {{valor_mensal_formatado}}, que são
// derivados deles. Resultado: sete campos existiam no código e não tinham
// caixa na tela, e um contrato de mensalidade fixa não tinha onde receber o
// valor.
//
// Por isso a lista é de ARRAYS: um derivado costuma comer vários campos, e
// esquecer um deles some com ele da tela outra vez.
const DERIVED_SOURCES: Record<string, string[]> = {
  contratante_qualificacao: [
    "contratante_documento", "contratante_endereco", "contratante_email",
    "contratante_representante", "contratante_representante_cpf",
  ],
  vigencia_inicio_extenso: ["vigencia_inicio"],
  vigencia_fim_extenso: ["vigencia_inicio", "vigencia_meses"],
  vigencia_fim: ["vigencia_inicio", "vigencia_meses"],
  data_assinatura_extenso: ["data_assinatura"],
  primeiro_vencimento: ["vigencia_inicio", "dia_vencimento"],
  valor_mensal_formatado: ["valor_mensal"],
  valor_mensal_extenso: ["valor_mensal"],
  valor_total_formatado: ["valor_mensal"],
  valor_total_extenso: ["valor_mensal"],
  valor_parcela_formatado: ["valor_mensal", "parcelas"],
  valor_parcela_extenso: ["valor_mensal", "parcelas"],
  verba_minima_formatada: ["verba_minima"],
  verba_minima_extenso: ["verba_minima"],
  tabela_escalonamento: ["escalonamento"],
  qtd_total_conteudos: ["qtd_estaticos", "qtd_carrosseis", "qtd_videos"],
};

// Quais campos ESTE contrato precisa que alguém digite. É o que decide as
// caixas do formulário: cada {{coisa}} do texto, mais os campos de onde as
// derivadas saem.
export function contractInputKeys(body: string): Set<string> {
  const keys = new Set<string>();
  for (const [, placeholder] of body.matchAll(PLACEHOLDER)) {
    if (CONTRACT_FIELD_BY_KEY.has(placeholder)) keys.add(placeholder);
    for (const origem of DERIVED_SOURCES[placeholder] ?? []) keys.add(origem);
  }
  return keys;
}

// Marca o que falta com um texto que ninguém manda pro cliente por engano.
export function pendingMarker(key: string): string {
  return `«${CONTRACT_FIELD_BY_KEY.get(key)?.label || DERIVED_LABELS[key] || key}»`;
}

// Os campos que a pessoa precisa preencher pra fechar as pendências, sem
// repetição: valor mensal aparece em quatro buracos do texto e é UMA coisa
// pra digitar.
//
// Recebe os valores atuais porque um derivado pode depender de cinco campos e
// faltar só um: cobrar os cinco mandaria a pessoa reconferir o que já está
// preenchido.
export function missingInputLabels(missing: string[], fields: ContractFields = {}): string[] {
  const chaves = new Set<string>();
  for (const key of missing) {
    const origens = DERIVED_SOURCES[key];
    if (!origens) { chaves.add(key); continue; }
    const vazias = origens.filter((origem) => !(fields[origem] || "").trim());
    // Todas preenchidas e mesmo assim faltou: o buraco é do derivado, então
    // é ele que aparece (é o caso do fim da vigência sem os meses).
    for (const origem of vazias.length ? vazias : [key]) chaves.add(origem);
  }
  const labels = [...chaves].map((key) => CONTRACT_FIELD_BY_KEY.get(key)?.label || DERIVED_LABELS[key] || key);
  return [...new Set(labels)];
}

export type RenderedContract = {
  text: string;
  /** Chaves que o texto pediu e ninguém preencheu. */
  missing: string[];
};

export function renderContract(
  body: string,
  fields: ContractFields,
  paymentMode: "pre" | "pos",
  structure: PaymentStructure = "mensal",
): RenderedContract {
  // O derivado vence o digitado de propósito: num contrato escalonado a
  // vigência que vale é a soma das faixas, mesmo que tenha sobrado um número
  // velho no campo de meses.
  const values: ContractFields = { ...fields, ...derivedFields(fields, paymentMode, structure) };
  const missing = new Set<string>();

  const text = body.replace(PLACEHOLDER, (_full, key: string) => {
    const value = (values[key] || "").trim();
    if (value) return value;
    missing.add(key);
    return pendingMarker(key);
  });

  return { text, missing: [...missing] };
}

// Um nome de arquivo que se acha depois na pasta de downloads.
export function contractFileName(title: string): string {
  const limpo = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return `contrato-${limpo.toLowerCase() || "sem-titulo"}`;
}

// O valor do contrato em uma linha, pra lista. Devolve vazio quando ainda não
// dá pra saber: a lista mostra "sem valor" em vez de "R$ 0,00", que seria uma
// informação errada em vez de uma informação faltando.
export function contractTotal(
  fields: ContractFields,
  paymentMode: "pre" | "pos",
  structure: PaymentStructure = "mensal",
): string {
  const total = derivedFields(fields, paymentMode, structure).valor_total_formatado;
  return total ? `R$ ${total}` : "";
}
