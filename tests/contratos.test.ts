import { describe, expect, it } from "vitest";
import { buildContractBody, buildPaymentClause, CONTRACT_FIELDS, CONTRACT_FIELD_BY_KEY, replacePaymentClause } from "../src/lib/contract-templates";
import { contractInputKeys, contractTotal, derivedFields, missingInputLabels, parseFaixas, pendingMarker, renderContract } from "../src/lib/contract-render";

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

describe("contrato escalonado", () => {
  const body = buildContractBody("gestao_marca", "pre", "escalonado");
  // O caso do Phedro: 3 meses a 2 mil, 3 a 2500, 6 a 3 mil.
  const DEGRAUS = { ...TARGET, escalonamento: "3 x 2000\n3 x 2500\n6 x 3000", vigencia_meses: "6" };

  it("12. a vigência é a soma das faixas, não o que está digitado no campo", () => {
    expect(derivedFields(DEGRAUS, "pre", "escalonado").vigencia_meses).toBe("12");
  });

  it("13. o total soma cada degrau pelos meses dele", () => {
    // 3x2000 + 3x2500 + 6x3000 = 6000 + 7500 + 18000
    const derived = derivedFields(DEGRAUS, "pre", "escalonado");
    expect(derived.valor_total_formatado).toBe("31.500,00");
    expect(derived.valor_total_extenso).toBe("trinta e um mil e quinhentos reais");
  });

  it("14. a tabela nomeia o intervalo de cada degrau", () => {
    const { text } = renderContract(body, DEGRAUS, "pre", "escalonado");
    expect(text).toContain("do 1º ao 3º mês: R$ 2.000,00 (dois mil reais) por mês");
    expect(text).toContain("do 4º ao 6º mês: R$ 2.500,00 (dois mil e quinhentos reais) por mês");
    expect(text).toContain("do 7º ao 12º mês: R$ 3.000,00 (três mil reais) por mês");
  });

  it("15. a vigência do contrato acompanha os 12 meses das faixas", () => {
    const { text } = renderContract(body, DEGRAUS, "pre", "escalonado");
    expect(text).toContain("01 de setembro de 2026 a 01 de setembro de 2027");
    expect(text).toContain("O contrato vigorará por 12 meses");
  });

  it("16. faixa de um mês só é lida como mês, não como intervalo", () => {
    const { text } = renderContract(body, { ...DEGRAUS, escalonamento: "1 x 1000\n2 x 2000" }, "pre", "escalonado");
    expect(text).toContain("no 1º mês: R$ 1.000,00");
    expect(text).toContain("do 2º ao 3º mês: R$ 2.000,00");
  });

  it("17. aceita as formas que se digita na correria", () => {
    const escritas = ["3 x 2000", "3x2000", "3 meses x 2000", "3 × R$ 2.000,00"];
    for (const escrita of escritas) {
      expect(parseFaixas(escrita), escrita).toEqual([{ meses: 3, valor: 2000 }]);
    }
  });

  it("18. trocar a estrutura reescreve só a cláusula 3", () => {
    const mensal = buildContractBody("gestao_marca", "pre", "mensal");
    const trocado = replacePaymentClause(mensal, buildPaymentClause("gestao_marca", "escalonado", "pre"));
    expect(trocado).toContain("mensalidades escalonadas");
    expect(trocado).not.toContain("durante {{vigencia_meses}} meses, totalizando");
    // Fora da cláusula 3, o documento continua idêntico ao que estava.
    const semPagamento = (t: string) => t.replace(/## CLÁUSULA 3[\s\S]*?(?=## CLÁUSULA 4)/, "");
    expect(semPagamento(trocado)).toBe(semPagamento(mensal));
  });

  it("19. uma edição manual em outra cláusula sobrevive à troca de estrutura", () => {
    const original = buildContractBody("gestao_marca", "pre", "mensal")
      .replace("antecedência mínima de 30 (trinta) dias", "antecedência mínima de 60 (sessenta) dias");
    const trocado = replacePaymentClause(original, buildPaymentClause("gestao_marca", "escalonado", "pre"));
    expect(trocado).toContain("60 (sessenta) dias");
  });

  it("20. o valor da lista sai do total, e some quando não dá pra calcular", () => {
    expect(contractTotal(DEGRAUS, "pre", "escalonado")).toBe("R$ 31.500,00");
    expect(contractTotal(TARGET, "pre", "mensal")).toBe("R$ 16.782,00");
    expect(contractTotal({}, "pre", "mensal")).toBe("");
  });
});


describe("o que falta no contrato", () => {
  const body = buildContractBody("gestao_marca", "pre", "mensal");
  // O contrato da Target como estava ao ser exportado: sem início de vigência
  // e sem data de assinatura.
  const SEM_DATAS = { ...TARGET, vigencia_inicio: "", data_assinatura: "" };

  it("21. o buraco no texto tem nome de gente, não nome de variável", () => {
    const { text } = renderContract(body, SEM_DATAS, "pre", "mensal");
    expect(text).toContain("«Início da vigência»");
    expect(text).toContain("«Data de assinatura»");
    expect(text).not.toContain("vigencia_inicio_extenso");
    expect(text).not.toContain("_extenso»");
  });

  it("22. a lista de pendências diz o que digitar, sem repetir", () => {
    const { missing } = renderContract(body, { ...TARGET, valor_mensal: "" }, "pre", "mensal");
    // O valor mensal abre quatro lacunas no texto e continua sendo um campo só.
    expect(missing.length).toBeGreaterThan(1);
    expect(missingInputLabels(missing)).toEqual(["Valor mensal em R$"]);
  });

  it("23. sem data de assinatura, o fecho acusa a falta em vez de virar 'Mineiros-GO.'", () => {
    const { text } = renderContract(body, SEM_DATAS, "pre", "mensal");
    expect(text).toContain("Mineiros-GO, «Data de assinatura».");
    expect(text).not.toContain("Mineiros-GO.\n");
  });

  it("24. contrato completo não tem marca nenhuma sobrando", () => {
    const completo = { ...TARGET, data_assinatura: "2026-09-03" };
    const { text, missing } = renderContract(body, completo, "pre", "mensal");
    expect(missing).toEqual([]);
    expect(text).not.toContain("«");
    expect(text).toContain("Mineiros-GO, 03 de setembro de 2026.");
  });

  it("25. campo digitável mantém o rótulo do formulário", () => {
    expect(pendingMarker("contratante_nome")).toBe("«Nome / Razão social»");
  });
});


// O teste que faltava. O formulário mostrava só campo cujo nome aparecia
// LITERALMENTE no contrato, e endereço, e-mail, valor mensal, início de
// vigência e data de assinatura nunca aparecem: o texto pede as versões
// derivadas deles. Sete campos existiam no código sem ter caixa na tela.
//
// A pergunta certa não é "o formulário mostra o campo X". É: preenchendo
// SÓ o que o formulário oferece, o contrato fica completo?
describe("o formulário dá conta do contrato inteiro", () => {
  const VALOR_DE_TESTE: Record<string, string> = {
    contratante_endereco: "Rua 1, 100, Centro\nGoiânia-GO 74000-000",
    contratante_email: "cliente@exemplo.com.br",
    contratante_documento: "00.000.000/0001-00",
    contratante_representante: "Fulano de Tal",
    contratante_representante_cpf: "000.000.000-00",
    vigencia_inicio: "2026-10-01",
    data_assinatura: "2026-09-30",
    escalonamento: "3 x 2000\n9 x 3000",
  };

  const casos = [
    { templateId: "gestao_marca", structure: "mensal" },
    { templateId: "gestao_marca", structure: "escalonado" },
    { templateId: "gestao_marca", structure: "projeto" },
    { templateId: "criacao_marca", structure: "projeto" },
  ] as const;

  for (const [i, caso] of casos.entries()) {
    it(`${26 + i}. ${caso.templateId} / ${caso.structure} fecha só com o que a tela pede`, () => {
      const body = buildContractBody(caso.templateId, "pre", caso.structure);
      const oferecidos = contractInputKeys(body);

      // Preenche exatamente as caixas que a tela mostraria, e nada além disso.
      const fields: Record<string, string> = {};
      for (const key of oferecidos) {
        const campo = CONTRACT_FIELD_BY_KEY.get(key);
        fields[key] = VALOR_DE_TESTE[key] ?? campo?.padrao ?? (campo?.type === "numero" ? "10" : "preenchido");
      }

      const { missing, text } = renderContract(body, fields, "pre", caso.structure);
      expect(missing, `sem caixa na tela: ${missingInputLabels(missing, fields).join(", ")}`).toEqual([]);
      expect(text).not.toContain("«");
    });
  }

  it("30. os cinco campos que mudam em todo contrato estão na tela", () => {
    const oferecidos = contractInputKeys(buildContractBody("gestao_marca", "pre", "mensal"));
    for (const key of ["contratante_nome", "contratante_documento", "contratante_endereco", "contratante_email", "forma_pagamento"]) {
      expect(oferecidos, key).toContain(key);
    }
  });

  it("31. a tela não pede campo que este contrato não usa", () => {
    const gestao = contractInputKeys(buildContractBody("gestao_marca", "pre", "mensal"));
    expect(gestao).not.toContain("prazo_entrega_marca");
    expect(gestao).not.toContain("parcelas");
  });

  it("32. bloco derivado vazio cobra os campos de digitar, não o nome do bloco", () => {
    const body = buildContractBody("gestao_marca", "pre", "mensal");
    const { missing } = renderContract(body, {}, "pre", "mensal");
    const cobrados = missingInputLabels(missing, {});
    // A qualificação da parte come cinco campos. A pendência lista os cinco,
    // porque é neles que se digita.
    for (const label of ["CPF / CNPJ", "Endereço completo com CEP", "E-mail"]) {
      expect(cobrados, label).toContain(label);
    }
    expect(cobrados).not.toContain("Dados do cliente");
  });

  it("33. campo opcional em branco não quebra a frase da qualificação", () => {
    // Pessoa física não tem representante legal. A frase precisa fechar sem
    // vírgula solta e sem "representada por" pendurado.
    const texto = derivedFields(
      { contratante_documento: "123.456.789-00", contratante_endereco: "Rua 1, 100" },
      "pre",
    ).contratante_qualificacao;
    expect(texto).toBe("inscrita no CPF sob o nº 123.456.789-00, com endereço na Rua 1, 100");
  });
});
