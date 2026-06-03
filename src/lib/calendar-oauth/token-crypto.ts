const ALGORITHM = "AES-GCM";
const IV_BYTES = 12;

async function importKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    Buffer.from(keyHex, "hex"),
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptRefreshToken(
  token: string,
  keyHex: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey(keyHex);
  const ivBytes = Buffer.allocUnsafe(IV_BYTES);
  crypto.getRandomValues(ivBytes);
  const encoded = Buffer.from(token, "utf-8");
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv: ivBytes }, key, encoded);
  return {
    ciphertext: Buffer.from(encrypted).toString("base64"),
    iv: ivBytes.toString("base64"),
  };
}

export async function decryptRefreshToken(
  ciphertext: string,
  iv: string,
  keyHex: string,
): Promise<string> {
  const key = await importKey(keyHex);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: Buffer.from(iv, "base64") },
    key,
    Buffer.from(ciphertext, "base64"),
  );
  return Buffer.from(decrypted).toString("utf-8");
}
