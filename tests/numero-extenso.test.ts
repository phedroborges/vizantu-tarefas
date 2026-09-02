import { describe, expect, it } from "vitest";
import { formatarReais, porExtenso, reaisPorExtenso } from "../src/lib/numero-extenso";

describe("valor por extenso do contrato", () => {
  it("1. escreve os valores que já foram pro contrato assinado", () => {
    expect(reaisPorExtenso(2797)).toBe("dois mil setecentos e noventa e sete reais");
    expect(reaisPorExtenso(16782)).toBe("dezesseis mil setecentos e oitenta e dois reais");
    expect(reaisPorExtenso(2000)).toBe("dois mil reais");
  });

  it("2. acerta a regra do 'e' entre os grupos", () => {
    expect(porExtenso(1200)).toBe("mil e duzentos");
    expect(porExtenso(1250)).toBe("mil duzentos e cinquenta");
    expect(porExtenso(1000)).toBe("mil");
    expect(porExtenso(100)).toBe("cem");
    expect(porExtenso(101)).toBe("cento e um");
  });

  it("3. milhão e bilhão levam o 'um', mil não leva", () => {
    expect(porExtenso(1_000_000)).toBe("um milhão");
    expect(porExtenso(2_000_000)).toBe("dois milhões");
    expect(porExtenso(1_000)).toBe("mil");
  });

  it("4. centavos entram no extenso", () => {
    expect(reaisPorExtenso(1500.5)).toBe("mil e quinhentos reais e cinquenta centavos");
    expect(reaisPorExtenso(1)).toBe("um real");
    expect(reaisPorExtenso(0.01)).toBe("um centavo");
    expect(reaisPorExtenso(0)).toBe("zero real");
  });

  it("5. o número escrito bate com o formato dos contratos antigos", () => {
    expect(formatarReais(2797)).toBe("2.797,00");
    expect(formatarReais(16782)).toBe("16.782,00");
  });
});
