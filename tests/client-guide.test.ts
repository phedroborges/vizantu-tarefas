import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CLIENT_GUIDE_BLOCKS,
  CLIENT_GUIDE_FIELDS,
  CLIENT_GUIDE_FIELD_KEYS,
  guideCompletion,
  isGuideFieldKey,
} from "../src/lib/client-guide";

const storage = readFileSync(new URL("../src/lib/storage.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260924100000_guia_do_cliente.sql", import.meta.url),
  "utf8",
);

// camelCase -> snake_case, a mesma convenção que PROFILE_FIELDS usa.
const paraColuna = (chave: string) => chave.replace(/[A-Z]/g, (letra) => `_${letra.toLowerCase()}`);

describe("campos do guia", () => {
  it("não repete chave entre blocos", () => {
    expect(new Set(CLIENT_GUIDE_FIELD_KEYS).size).toBe(CLIENT_GUIDE_FIELD_KEYS.length);
  });

  it("toda pergunta é pergunta de verdade, não substantivo", () => {
    // A ficha antiga tinha "Observações" e ficou vazia em treze de catorze
    // clientes. Campo que não pergunta não é respondido. A única exceção é o
    // tamanho de camiseta, que é escolha e não cabe interrogação.
    const semInterrogacao = CLIENT_GUIDE_FIELDS
      .filter((campo) => campo.kind !== "escolha")
      .filter((campo) => !campo.pergunta.includes("?"));
    expect(semInterrogacao.map((campo) => campo.key)).toEqual([]);
  });

  it("todo campo tem ajuda", () => {
    expect(CLIENT_GUIDE_FIELDS.filter((campo) => !campo.ajuda.trim())).toEqual([]);
  });

  // O elo fraco: a lista de campos vive em três lugares (aqui, no
  // PROFILE_FIELDS do storage e nas colunas do Postgres). Esquecer um deles
  // faz o campo aparecer na tela e nunca salvar, em silêncio.
  it("todo campo tem coluna no PROFILE_FIELDS do storage", () => {
    const faltando = CLIENT_GUIDE_FIELD_KEYS.filter(
      (chave) => !storage.includes(`["${chave}", "${paraColuna(chave)}"]`),
    );
    expect(faltando).toEqual([]);
  });

  it("todo campo tem coluna criada na migration", () => {
    const faltando = CLIENT_GUIDE_FIELD_KEYS.filter(
      (chave) => !migration.includes(`add column if not exists ${paraColuna(chave)} text`),
    );
    expect(faltando).toEqual([]);
  });

  it("reconhece só as chaves do guia", () => {
    expect(isGuideFieldKey("pontosDePrecisao")).toBe(true);
    // Campo de cadastro e caixa antiga não são do guia: se passassem por
    // isGuideFieldKey, editar o CNPJ marcaria um campo do guia como manual.
    expect(isGuideFieldKey("razaoSocial")).toBe(false);
    expect(isGuideFieldKey("observacoes")).toBe(false);
  });
});

describe("progresso do guia", () => {
  it("conta zero quando ninguém respondeu nada", () => {
    const progresso = guideCompletion({});
    expect(progresso.preenchidos).toBe(0);
    expect(progresso.percentual).toBe(0);
    expect(progresso.total).toBe(CLIENT_GUIDE_FIELDS.length);
  });

  it("ignora perfil inexistente sem quebrar", () => {
    expect(guideCompletion(undefined).preenchidos).toBe(0);
  });

  it("não conta campo que só tem espaço em branco", () => {
    expect(guideCompletion({ quemEh: "   " }).preenchidos).toBe(0);
  });

  it("soma por bloco e no total", () => {
    const progresso = guideCompletion({ quemEh: "Dono de pet shop", desejo: "Vender mais ração" });
    expect(progresso.preenchidos).toBe(2);
    expect(progresso.porBloco.find((bloco) => bloco.key === "quem")?.preenchidos).toBe(1);
    expect(progresso.porBloco.find((bloco) => bloco.key === "quer")?.preenchidos).toBe(1);
    expect(progresso.porBloco.find((bloco) => bloco.key === "lidar")?.preenchidos).toBe(0);
  });

  it("chega a 100% com todos os campos respondidos", () => {
    const cheio = Object.fromEntries(CLIENT_GUIDE_FIELD_KEYS.map((chave) => [chave, "respondido"]));
    expect(guideCompletion(cheio).percentual).toBe(100);
  });

  it("cobre todos os blocos declarados", () => {
    expect(guideCompletion({}).porBloco.map((bloco) => bloco.key))
      .toEqual(CLIENT_GUIDE_BLOCKS.map((bloco) => bloco.key));
  });
});
