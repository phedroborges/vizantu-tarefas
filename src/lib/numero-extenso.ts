// Valor por extenso, do jeito que vai escrito no contrato.
//
// "R$ 2.797,00 (dois mil setecentos e noventa e sete reais)" é escrito à mão
// hoje, e é o lugar mais fácil de errar sem ninguém perceber: o número está
// certo, o extenso está errado, e num contrato o extenso é o que prevalece na
// leitura. Aqui ele sai do próprio número, então os dois nunca discordam.

const UNIDADES = [
  "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
const ESCALAS: { singular: string; plural: string }[] = [
  { singular: "", plural: "" },
  { singular: "mil", plural: "mil" },
  { singular: "milhão", plural: "milhões" },
  { singular: "bilhão", plural: "bilhões" },
];

// Um grupo de até três dígitos ("setecentos e noventa e sete").
function grupo(valor: number): string {
  if (valor === 100) return "cem";
  const partes: string[] = [];
  const centena = Math.floor(valor / 100);
  const resto = valor % 100;
  if (centena) partes.push(CENTENAS[centena]);
  if (resto < 20) {
    if (resto) partes.push(UNIDADES[resto]);
  } else {
    const dezena = Math.floor(resto / 10);
    const unidade = resto % 10;
    partes.push(unidade ? `${DEZENAS[dezena]} e ${UNIDADES[unidade]}` : DEZENAS[dezena]);
  }
  return partes.join(" e ");
}

// Junta os grupos com a regra do "e" do português: o último grupo entra com
// "e" quando é menor que cem ou centena redonda ("mil e duzentos"), e sem
// ligação nenhuma quando não é ("dois mil setecentos e noventa e sete"). Essa
// segunda forma é a que está nos contratos que a casa já assinou, e é ela que
// manda aqui.
export function porExtenso(numero: number): string {
  const inteiro = Math.floor(Math.abs(numero));
  if (inteiro === 0) return "zero";

  const grupos: { valor: number; escala: number }[] = [];
  let restante = inteiro;
  for (let escala = 0; restante > 0; escala++) {
    const valor = restante % 1000;
    if (valor) grupos.unshift({ valor, escala });
    restante = Math.floor(restante / 1000);
  }

  const escritos = grupos.map(({ valor, escala }) => {
    const nome = ESCALAS[escala];
    if (!nome?.singular) return grupo(valor);
    // "mil" não leva "um" na frente; milhão e bilhão levam.
    if (escala === 1) return valor === 1 ? "mil" : `${grupo(valor)} mil`;
    return `${grupo(valor)} ${valor === 1 ? nome.singular : nome.plural}`;
  });

  return escritos.reduce((texto, atual, indice) => {
    if (!texto) return atual;
    const { valor } = grupos[indice];
    const ligacao = grupos[indice].escala === 0 && (valor < 100 || valor % 100 === 0) ? " e " : " ";
    return texto + ligacao + atual;
  }, "");
}

// O extenso completo de um valor em reais, com centavos quando houver.
export function reaisPorExtenso(valor: number): string {
  // Arredonda em centavos ANTES de separar, senão 0.1 + 0.2 vira 29 centavos.
  const centavosTotais = Math.round(Math.abs(valor) * 100);
  const inteiro = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;

  const partes: string[] = [];
  if (inteiro) partes.push(`${porExtenso(inteiro)} ${inteiro === 1 ? "real" : "reais"}`);
  if (centavos) partes.push(`${porExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (!partes.length) return "zero real";
  return partes.join(" e ");
}

// R$ 2.797,00 — o mesmo formato que já está nos contratos antigos.
export function formatarReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
