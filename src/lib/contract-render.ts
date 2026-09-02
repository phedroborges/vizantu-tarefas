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

  const local = (fields.foro || "").trim();
  const assinatura = derived.data_assinatura_extenso;
  if (local || assinatura) derived.local_data = [local, assinatura].filter(Boolean).join(", ") + ".";

  // Lista de e-mails numa linha só, do jeito que a cláusula lê.
  const emails = (fields.emails_vizantu || "").split("\n").map((linha) => linha.trim()).filter(Boolean);
  if (emails.length) derived.emails_vizantu = emails.join(" / ");

  return derived;
}

// Marca o que falta com um texto que ninguém manda pro cliente por engano.
export function pendingMarker(key: string): string {
  return `«${CONTRACT_FIELD_BY_KEY.get(key)?.label || key}»`;
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
