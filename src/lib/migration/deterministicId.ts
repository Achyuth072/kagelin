// Fixed, arbitrary v4 UUID used as the v5 namespace for migration ids.
const NAMESPACE = "6d3f2b0a-6a41-5f2f-9c3a-8e1f6b6d9a2b";

function parseUuid(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export async function deriveMigrationId(localId: string): Promise<string> {
  const namespaceBytes = parseUuid(NAMESPACE);
  const nameBytes = new TextEncoder().encode(localId);
  const input = new Uint8Array(namespaceBytes.length + nameBytes.length);
  input.set(namespaceBytes);
  input.set(nameBytes, namespaceBytes.length);

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  digest[6] = (digest[6] & 0x0f) | 0x50; // version 5
  digest[8] = (digest[8] & 0x3f) | 0x80; // variant 10

  return formatUuid(digest.slice(0, 16));
}
