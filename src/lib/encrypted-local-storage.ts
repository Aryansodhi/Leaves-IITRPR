type EncryptedPayloadV1 = {
  v: 1;
  salt: string;
  iv: string;
  data: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const hasSubtleCrypto = () =>
  typeof window !== "undefined" &&
  Boolean(window.crypto?.subtle) &&
  typeof window.crypto.getRandomValues === "function";

const SESSION_SECRET_KEY = "lf-enc-secret-v1";

export const getSessionEncryptionPassword = () => {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(SESSION_SECRET_KEY);
    if (existing) return existing;

    if (!hasSubtleCrypto()) return "";
    const bytes = window.crypto.getRandomValues(new Uint8Array(32));
    const secret = toBase64(bytes);
    window.sessionStorage.setItem(SESSION_SECRET_KEY, secret);
    return secret;
  } catch {
    return "";
  }
};

const deriveKey = async (password: string, salt: Uint8Array) => {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 120_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

export const encryptForLocalStorage = async (
  password: string,
  plaintext: string,
): Promise<string> => {
  if (!hasSubtleCrypto()) return plaintext;

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plaintext),
  );

  const payload: EncryptedPayloadV1 = {
    v: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(ciphertext)),
  };

  return JSON.stringify(payload);
};

export const decryptFromLocalStorage = async (
  password: string,
  payloadOrPlaintext: string,
): Promise<string> => {
  if (!hasSubtleCrypto()) return payloadOrPlaintext;

  let payload: EncryptedPayloadV1 | null = null;
  try {
    payload = JSON.parse(payloadOrPlaintext) as EncryptedPayloadV1;
  } catch {
    return payloadOrPlaintext;
  }

  if (!payload || payload.v !== 1) return payloadOrPlaintext;

  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const data = fromBase64(payload.data);

  const key = await deriveKey(password, salt);
  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );

  return textDecoder.decode(plaintext);
};

export const saveEncryptedItem = async (
  storageKey: string,
  password: string,
  value: string,
) => {
  if (typeof window === "undefined") return;
  const encoded = await encryptForLocalStorage(password, value);
  window.localStorage.setItem(storageKey, encoded);
};

export const loadDecryptedItem = async (
  storageKey: string,
  password: string,
): Promise<string | null> => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return await decryptFromLocalStorage(password, raw);
  } catch {
    return null;
  }
};

export const removeItem = (storageKey: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
};
