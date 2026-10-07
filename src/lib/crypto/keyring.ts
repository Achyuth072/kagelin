import { envelopeKeyId, INITIAL_KEY_ID } from "@/lib/crypto/envelope";
import type { EncryptionKeyRow } from "@/lib/crypto/encryptionKeyRowCache";
import type { Keyring } from "@/lib/crypto/keyStore";

// Null when the envelope names a key this device does not hold (e.g. rotated elsewhere).
export function keyForEnvelope(
  keyring: Keyring,
  envelope: string,
): Uint8Array | null {
  const id = envelopeKeyId(envelope);
  if (id === undefined) return null;
  if (id === keyring.keyId) return keyring.key;
  return keyring.retired[id] ?? null;
}

// Envelopes and the keyring carry the key id as text; the key row stores it as an integer.
export function currentKeyIdOf(
  row: Pick<EncryptionKeyRow, "current_key_id"> | null,
): string {
  return String(row?.current_key_id ?? INITIAL_KEY_ID);
}
