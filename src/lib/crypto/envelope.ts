import { getSodium } from "@/lib/crypto/sodium";

// Must match the scheme literal in supabase/schema.sql (encrypted_notification_body).
export const SCHEME = "xchacha20poly1305-v1";

// Row-bound scheme: the AEAD associated data is the value's Binding.
export const SCHEME_V2 = "xchacha20poly1305-v2";

export interface Binding {
  userId: string;
  table: string;
  column: string;
  rowId: string;
}

// The key id of an Account that has never rotated.
export const INITIAL_KEY_ID = "1";

// Copies input into the current realm to satisfy libsodium's instanceof check across realms (e.g. jsdom).
export function toUint8Array(input: Uint8Array): Uint8Array {
  return Uint8Array.from(input);
}

export async function bytesToBase64(bytes: Uint8Array): Promise<string> {
  const sodium = await getSodium();
  return sodium.to_base64(toUint8Array(bytes), sodium.base64_variants.ORIGINAL);
}

export async function base64ToBytes(base64: string): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.from_base64(base64, sodium.base64_variants.ORIGINAL);
}

// A row-bound value failed authentication: it was moved, altered or sealed under another key.
const CIPHERTEXT_TAMPERED_CODE = "ciphertext_tampered";

export class TamperError extends Error {
  readonly code = CIPHERTEXT_TAMPERED_CODE;
  constructor() {
    super(
      "Decryption failed: this value was moved, altered or sealed for another place.",
    );
  }
}

export function isTamperError(error: unknown): error is TamperError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === CIPHERTEXT_TAMPERED_CODE
  );
}

const CIPHERTEXT_CORRUPT_CODE = "ciphertext_corrupt";

function corruptCiphertextError(message: string): Error {
  return Object.assign(new Error(message), { code: CIPHERTEXT_CORRUPT_CODE });
}

// True when the value itself is bad, as opposed to a missing key or a failure to load libsodium.
export function isUnopenableValueError(error: unknown): boolean {
  if (isTamperError(error)) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === CIPHERTEXT_CORRUPT_CODE
  );
}

// True for plaintext, `-v1` and retired-key values: anything a Re-seal still has to rewrite.
export function needsReseal(value: unknown, currentKeyId: string): boolean {
  return (
    typeof value !== "string" ||
    !value.startsWith(`${SCHEME_V2}:${currentKeyId}:`)
  );
}

export function envelopeKeyId(envelope: string): string | undefined {
  return envelope.split(":")[1] || undefined;
}

export function isEnvelope(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith(`${SCHEME}:`) || value.startsWith(`${SCHEME_V2}:`))
  );
}

// Length-prefixed so no two distinct bindings share an encoding.
function bindingAad(binding: Binding): Uint8Array {
  const encoder = new TextEncoder();
  const parts = [
    SCHEME_V2,
    binding.userId,
    binding.table,
    binding.column,
    binding.rowId,
  ].map((part) => encoder.encode(part));
  const aad = new Uint8Array(
    parts.reduce((total, part) => total + 4 + part.length, 0),
  );
  const view = new DataView(aad.buffer);
  let offset = 0;
  for (const part of parts) {
    view.setUint32(offset, part.length);
    aad.set(part, offset + 4);
    offset += 4 + part.length;
  }
  return aad;
}

export async function sealEnvelope(
  key: Uint8Array,
  plaintext: Uint8Array,
  keyId: string = INITIAL_KEY_ID,
  binding?: Binding,
): Promise<string> {
  const sodium = await getSodium();
  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
  );
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    toUint8Array(plaintext),
    binding ? bindingAad(binding) : null,
    null,
    nonce,
    toUint8Array(key),
  );
  const nonceB64 = await bytesToBase64(nonce);
  const ciphertextB64 = await bytesToBase64(ciphertext);
  return `${binding ? SCHEME_V2 : SCHEME}:${keyId}:${nonceB64}:${ciphertextB64}`;
}

export async function openEnvelope(
  key: Uint8Array,
  envelope: string,
  binding?: Binding,
): Promise<Uint8Array> {
  const [scheme, keyId, nonceB64, ciphertextB64] = envelope.split(":");
  if (
    (scheme !== SCHEME && scheme !== SCHEME_V2) ||
    !keyId ||
    !nonceB64 ||
    !ciphertextB64
  ) {
    throw corruptCiphertextError("Unrecognized ciphertext envelope");
  }
  let aad: Uint8Array | null = null;
  if (scheme === SCHEME_V2) {
    if (!binding) {
      throw new Error(
        "A row-bound ciphertext cannot be opened without its binding",
      );
    }
    aad = bindingAad(binding);
  }

  const sodium = await getSodium();
  let nonce: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    nonce = sodium.from_base64(nonceB64, sodium.base64_variants.ORIGINAL);
    ciphertext = sodium.from_base64(
      ciphertextB64,
      sodium.base64_variants.ORIGINAL,
    );
  } catch {
    throw corruptCiphertextError("Unrecognized ciphertext envelope");
  }

  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      toUint8Array(ciphertext),
      aad,
      toUint8Array(nonce),
      toUint8Array(key),
    );
  } catch {
    if (aad) throw new TamperError();
    throw corruptCiphertextError(
      "Decryption failed: wrong key or corrupted ciphertext",
    );
  }
}
