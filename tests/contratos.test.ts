import { describe, expect, it } from "vitest";
import { buildContractBody, CONTRACT_FIELDS } from "../src/lib/contract-templates";
import { derivedFields, renderContract } from "../src/lib/contract-render";

// O cliente novo que o Phedro mandou junto com o pedido.
const TARGET = {
  contratante_nome: "Target Negocios de Informacoes Ltda",
  contratante_documento: "00.086.483/0001-99",
  contratante_endereco: "Rua 504, 214 Setor Centro Oeste\nGoiânia-GO 74550-160",
  contratante_email: "neto.borges@targetinformacoes.com.br\ntalita.helena@targetinformacoes.com.br",
  forma_pagamento: "Faturado/Boleto",
  marca: "a marca Target",
  vigencia_meses: "6",
  vigencia_inicio: "2026-09-01",
  valor_mensal: "2797",
  dia_vencimento: "25",
  data_assinatura: "2026-09-02",
  foro: "Mineiros-GO",
  qtd_estaticos: "5",
  qtd_carrosseis: "5",
  qtd_videos: "10",
  verba_minima: "2000",
  emails_vizantu: "contato@vizantu.com.br\nphedro@vizantu.com.br",
  contratante_representante: "Neto Borges",
  contratante_representante_cpf: "000.000.000-00",
};

describe("modelo de contrato", () => {
  it("1. a numeração das cláusulas não repete nem pula", () => {
    for (const templateId of ["gestao_marca", "criacao_marca"] as const) {
      const body = buildContractBody(templateId, "pre");
      const numeros = [...body.matchAll(/^## CLÁUSULA (\d+) /gm)].map((m) => Number(m[1]));
      expect(numeros).toEqual(Array.from({ length: numeros.length }, (_, i) => i + 1));
    }
  });

  it("2. nenhum modelo sai com marcação de numeração sobrando", () => {
    for (const templateId of ["gestao_marca", "criacao_marca", "branco"] as const) {
      expect(buildContractBody(templateId, "pre")).not.toContain("{{n_");
    }
  });

  it("3. todo campo que os modelos pedem existe no formulário", () => {
    const conhecidos = new Set([...CONTRACT_FIELDS.map((f) => f.key), ...Object.keys(derivedFields({}, "pre")),
      "valor_mensal_formatado", "valor_mensal_extenso", "valor_total_formatado", "valor_total_extenso",
      "valor_parcela_formatado", "valor_parcela_extenso", "verba_minima_formatada", "verba_minima_extenso",
      "titulo_servico", "titulo_servico_frase", "local_data"]);
    for (const templateId of ["gestao_marca", "criacao_marca", "branco"] as const) {
      for (const [, key] of buildContractBody(templateId, "pre").matchAll(/\{\{(\w+)\}\}/g)) {
        expect(conhecidos, `campo ${key} não tem de onde vir`).toContain(key);
      }
    }
  });

  it("4. pré-pago e pós-pago mudam a cláusula de pagamento e nada mais", () => {
    const pre = buildContractBody("gestao_marca", "pre");
    const pos = buildContractBody("gestao_marca", "pos");
    expect(pre).toContain("O pagamento é antecipado");
    expect(pos).not.toContain("O pagamento é antecipado");
    expect(pos).toContain("dos meses subsequentes");
    // Fora da cláusula 3, os dois textos são o mesmo documento.
    const semPagamento = (texto: string) => texto.replace(/## CLÁUSULA 3[\s\S]*?(?=## CLÁUSULA 4)/, "");
    expect(semPagamento(pre)).toBe(semPagamento(pos));
  });
});

describe("preenchimento do contrato", () => {
  const body = buildContractBody("gestao_marca", "pre");

  it("5. o contrato do cliente novo sai completo, sem campo faltando", () => {
    const { missing } = renderContract(body, TARGET, "pre");
    expect(missing).toEqual([]);
  });

  it("6. o total, o extenso e a data final saem da conta, não da digitação", () => {
    const { text } = renderContract(body, TARGET, "pre");
    expect(text).toContain("R$ 2.797,00 (dois mil setecentos e noventa e sete reais)");
    expect(text).toContain("R$ 16.782,00 (dezesseis mil setecentos e oitenta e dois reais)");
    expect(text).toContain("01 de setembro de 2026 a 01 de março de 2027");
    expect(text).toContain("20 conteúdos planejados");
  });

  it("7. no pré-pago o primeiro vencimento cai antes do mês de execução", () => {
    expect(derivedFields(TARGET, "pre").primeiro_vencimento).toBe("25 de agosto de 2026");
    expect(derivedFields(TARGET, "pos").primeiro_vencimento).toBe("25 de setembro de 2026");
  });

  it("8. campo vazio aparece marcado, nunca como buraco silencioso", () => {
    const { text, missing } = renderContract(body, { ...TARGET, valor_mensal: "" }, "pre");
    expect(missing).toContain("valor_mensal_formatado");
    expect(text).toContain("«");
    expect(text).not.toContain("R$  (");
  });

  it("9. a qualificação da parte se ajusta ao que foi preenchido", () => {
    expect(derivedFields(TARGET, "pre").contratante_qualificacao)
      .toContain("inscrita no CNPJ sob o nº 00.086.483/0001-99");
    // Pessoa física: o documento é lido como CPF, sem representante inventado.
    const pf = derivedFields({ contratante_documento: "123.456.789-00" }, "pre").contratante_qualificacao;
    expect(pf).toContain("inscrita no CPF");
    expect(pf).not.toContain("representada por");
  });

  it("10. o endereço em várias linhas vira uma frase só, sem vírgula solta", () => {
    const texto = derivedFields(TARGET, "pre").contratante_qualificacao;
    expect(texto).toContain("Rua 504, 214 Setor Centro Oeste, Goiânia-GO 74550-160");
    expect(texto).not.toContain(", ,");
  });

  it("11. valor digitado com pontuação brasileira vale o mesmo que sem", () => {
    const comPonto = renderContract(body, { ...TARGET, valor_mensal: "2.797,00" }, "pre").text;
    const semPonto = renderContract(body, TARGET, "pre").text;
    expect(comPonto).toBe(semPonto);
  });
});
