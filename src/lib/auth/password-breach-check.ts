const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";

/** Returns null where `crypto.subtle` is unavailable (non-secure contexts). */
export async function sha1Hex(password: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(password),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Only `prefix` is ever sent to the HIBP range API. */
export function splitHash(hashHex: string): {
  prefix: string;
  suffix: string;
} {
  return { prefix: hashHex.slice(0, 5), suffix: hashHex.slice(5) };
}

/** Whether `suffix` appears in a `SUFFIX:count` range-API response body. */
export function suffixInResponse(
  responseBody: string,
  suffix: string,
): boolean {
  return responseBody
    .split("\n")
    .some((line) => line.split(":")[0].trim() === suffix);
}

/** Fails open (resolves false, never rejects) on any error. */
export async function isPasswordBreached(password: string): Promise<boolean> {
  const hash = await sha1Hex(password);
  if (!hash) return false;

  const { prefix, suffix } = splitHash(hash);

  try {
    const response = await fetch(`${HIBP_RANGE_URL}${prefix}`);
    if (!response.ok) return false;
    const body = await response.text();
    return suffixInResponse(body, suffix);
  } catch {
    return false;
  }
}
