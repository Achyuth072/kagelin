import { getSodium } from "@/lib/crypto/sodium";
import {
  sealEnvelope,
  openEnvelope,
  isEnvelope,
  type Binding,
} from "@/lib/crypto/envelope";

export const isCiphertext = isEnvelope;

export async function encryptField(
  key: Uint8Array,
  plaintext: string,
  binding?: Binding,
): Promise<string> {
  const sodium = await getSodium();
  return sealEnvelope(key, sodium.from_string(plaintext), undefined, binding);
}

export async function decryptField(
  key: Uint8Array,
  envelope: string,
  binding?: Binding,
): Promise<string> {
  const sodium = await getSodium();
  const plaintext = await openEnvelope(key, envelope, binding);
  return sodium.to_string(plaintext);
}
