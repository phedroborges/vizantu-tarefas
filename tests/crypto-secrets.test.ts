import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

describe("segredo de credencial", () => {
  let cripto: typeof import("../src/lib/crypto-secrets");

  beforeAll(async () => {
    process.env.CREDENTIALS_KEY = randomBytes(32).toString("base64");
    cripto = await import("../src/lib/crypto-secrets");
  });

  it("1. o que sai da cifra não contém a senha em lugar nenhum", () => {
    const guardado = cripto.encryptSecret("SenhaDoInstagram#2026");
    expect(guardado).not.toContain("SenhaDoInstagram");
    expect(guardado.startsWith("v1.")).toBe(true);
  });

  it("2. decifrar devolve exatamente o que entrou, inclusive acento e emoji", () => {
    for (const senha of ["s3nh@ com espaço", "ação-ção", "🔐chave", "a".repeat(500)]) {
      expect(cripto.decryptSecret(cripto.encryptSecret(senha))).toBe(senha);
    }
  });

  it("3. cifrar a mesma senha duas vezes dá resultados diferentes", () => {
    // Sem isso, duas contas com a mesma senha ficariam idênticas no banco e
    // qualquer um veria isso de olho.
    expect(cripto.encryptSecret("igual")).not.toBe(cripto.encryptSecret("igual"));
  });

  it("4. segredo adulterado no banco não decifra em silêncio", () => {
    const guardado = cripto.encryptSecret("original");
    const partes = guardado.split(".");
    const adulterado = [partes[0], partes[1], partes[2], Buffer.from("outra coisa").toString("base64")].join(".");
    expect(() => cripto.decryptSecret(adulterado)).toThrow();
  });

  it("5. sem chave configurada, recusa gravar em vez de gravar aberto", async () => {
    const original = process.env.CREDENTIALS_KEY;
    delete process.env.CREDENTIALS_KEY;
    expect(cripto.secretsAvailable()).toBe(false);
    expect(() => cripto.encryptSecret("senha")).toThrow(cripto.MissingSecretKeyError);
    process.env.CREDENTIALS_KEY = original;
  });

  it("6. chave de tamanho errado é recusada, não usada torta", () => {
    const original = process.env.CREDENTIALS_KEY;
    process.env.CREDENTIALS_KEY = Buffer.from("curta").toString("base64");
    expect(() => cripto.encryptSecret("senha")).toThrow(cripto.MissingSecretKeyError);
    process.env.CREDENTIALS_KEY = original;
  });
});
