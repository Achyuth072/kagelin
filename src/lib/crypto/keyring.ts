import { envelopeKeyId } from "@/lib/crypto/envelope";
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
