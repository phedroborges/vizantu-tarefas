import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Senha de cliente não pode ficar legível no banco.
//
// O banco é lido por muita gente e por muita coisa: um backup, um dump pra
// depurar, o painel do Supabase aberto na tela numa reunião, um dia um acesso
// de leitura concedido a alguém. Guardar a senha do Instagram de um cliente em
// texto puro transforma qualquer um desses momentos num vazamento.
//
// Então o segredo entra cifrado (AES-256-GCM) com uma chave que vive só na
// variável de ambiente do servidor. Quem tiver o banco sem a chave tem lixo, e
// quem tiver a chave sem o banco não tem nada.
//
// A regra mais importante deste arquivo: SEM CHAVE, NÃO GRAVA. Cair no texto
// puro quando a variável não está configurada seria trocar uma falha visível
// (não consigo salvar) por uma invisível (salvei aberto e ninguém percebeu).

const ALGORITMO = "aes-256-gcm";
const PREFIXO = "v1";

export class MissingSecretKeyError extends Error {
  constructor() {
    super(
      "As credenciais não estão configuradas neste servidor. Defina CREDENTIALS_KEY (32 bytes em base64) nas variáveis de ambiente antes de salvar senhas.",
    );
    this.name = "MissingSecretKeyError";
  }
}

function chave(): Buffer {
  const raw = process.env.CREDENTIALS_KEY;
  if (!raw) throw new MissingSecretKeyError();
  const key = Buffer.from(raw, "base64");
  // 32 bytes é o tamanho do AES-256. Uma chave curta demais aceita em silêncio
  // daria uma cifra mais fraca do que o nome do algoritmo promete.
  if (key.length !== 32) throw new MissingSecretKeyError();
  return key;
}

export function secretsAvailable(): boolean {
  try {
    chave();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, chave(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [PREFIXO, iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const [versao, iv, tag, dados] = stored.split(".");
  if (versao !== PREFIXO || !iv || !tag || !dados) {
    throw new Error("Este segredo foi gravado num formato que este servidor não conhece.");
  }
  const decipher = createDecipheriv(ALGORITMO, chave(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dados, "base64")), decipher.final()]).toString("utf8");
}
