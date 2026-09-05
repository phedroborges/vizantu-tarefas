import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

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
const PREFIXO_DERIVADO = "v1s";

export class MissingSecretKeyError extends Error {
  constructor() {
    super(
      "As credenciais não estão configuradas neste servidor. Defina CREDENTIALS_KEY (32 bytes em base64) ou SUPABASE_SERVICE_ROLE_KEY antes de salvar senhas.",
    );
    this.name = "MissingSecretKeyError";
  }
}

function chave(forceDerived = false): Buffer {
  const raw = process.env.CREDENTIALS_KEY;
  // O service-role já é um segredo server-only de alta entropia e está
  // presente em toda instalação funcional do app. Derivar uma chave com
  // contexto próprio torna o cofre utilizável sem duplicar configuração e
  // sem usar o próprio token diretamente como chave AES.
  if (!raw || forceDerived) {
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRole) throw new MissingSecretKeyError();
    return createHash("sha256").update("vizantu-project-credentials:v1\0").update(serviceRole).digest();
  }
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
  const derived = !process.env.CREDENTIALS_KEY;
  const cipher = createCipheriv(ALGORITMO, chave(derived), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [derived ? PREFIXO_DERIVADO : PREFIXO, iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const [versao, iv, tag, dados] = stored.split(".");
  if ((versao !== PREFIXO && versao !== PREFIXO_DERIVADO) || !iv || !tag || !dados) {
    throw new Error("Este segredo foi gravado num formato que este servidor não conhece.");
  }
  const decipher = createDecipheriv(ALGORITMO, chave(versao === PREFIXO_DERIVADO), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dados, "base64")), decipher.final()]).toString("utf8");
}
