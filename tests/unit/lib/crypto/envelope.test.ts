import { describe, it, expect } from "vitest";
import { getSodium } from "@/lib/crypto/sodium";
import {
  SCHEME,
  SCHEME_V2,
  CURRENT_KEY_ID,
  isEnvelope,
  sealEnvelope,
  openEnvelope,
  isTamperError,
  needsReseal,
} from "@/lib/crypto/envelope";

async function generateKey(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(32);
}

describe("sealEnvelope / openEnvelope", () => {
  it("round-trips arbitrary bytes", async () => {
    const key = await generateKey();
    const plaintext = new TextEncoder().encode("hello, world");

    const envelope = await sealEnvelope(key, plaintext);
    const decrypted = await openEnvelope(key, envelope);

    expect(new TextDecoder().decode(decrypted)).toBe("hello, world");
  });

  it("stamps the current scheme and key id by default", async () => {
    const key = await generateKey();
    const envelope = await sealEnvelope(key, new TextEncoder().encode("x"));
    const [scheme, keyId] = envelope.split(":");
    expect(scheme).toBe(SCHEME);
    expect(keyId).toBe(CURRENT_KEY_ID);
  });

  it("accepts an explicit key id for rotation", async () => {
    const key = await generateKey();
    const envelope = await sealEnvelope(
      key,
      new TextEncoder().encode("x"),
      "2",
    );
    expect(envelope.split(":")[1]).toBe("2");
  });

  it("rejects decryption with the wrong key", async () => {
    const key = await generateKey();
    const wrongKey = await generateKey();
    const envelope = await sealEnvelope(
      key,
      new TextEncoder().encode("secret"),
    );

    await expect(openEnvelope(wrongKey, envelope)).rejects.toThrow();
  });

  it("rejects an envelope with an unrecognized scheme", async () => {
    const key = await generateKey();
    const envelope = await sealEnvelope(key, new TextEncoder().encode("x"));
    const tampered = envelope.replace(SCHEME, "some-other-scheme");

    await expect(openEnvelope(key, tampered)).rejects.toThrow(
      "Unrecognized ciphertext envelope",
    );
  });
});

describe("isEnvelope", () => {
  it("recognizes a sealed envelope and rejects plaintext", async () => {
    const key = await generateKey();
    const envelope = await sealEnvelope(key, new TextEncoder().encode("x"));

    expect(isEnvelope(envelope)).toBe(true);
    expect(isEnvelope("plain text")).toBe(false);
    expect(isEnvelope(null)).toBe(false);
  });
});

describe("row-bound (-v2) envelopes", () => {
  const binding = {
    userId: "user-1",
    table: "tasks",
    column: "content",
    rowId: "row-1",
  };
  const seal = async (key: Uint8Array, b = binding) =>
    sealEnvelope(key, new TextEncoder().encode("secret"), CURRENT_KEY_ID, b);

  it("opens with the binding it was sealed under", async () => {
    const key = await generateKey();
    const envelope = await seal(key);

    expect(isEnvelope(envelope)).toBe(true);
    expect(envelope.startsWith(`${SCHEME_V2}:`)).toBe(true);
    const opened = await openEnvelope(key, envelope, binding);
    expect(new TextDecoder().decode(opened)).toBe("secret");
  });

  it.each([
    ["user", { userId: "user-2" }],
    ["table", { table: "habits" }],
    ["column", { column: "description" }],
    ["row", { rowId: "row-2" }],
  ])("fails when opened for another %s", async (_name, change) => {
    const key = await generateKey();
    const envelope = await seal(key);

    await expect(
      openEnvelope(key, envelope, { ...binding, ...change }),
    ).rejects.toThrow();
  });

  it("does not let field boundaries shift between binding parts", async () => {
    const key = await generateKey();
    const envelope = await seal(key, { ...binding, table: "ab", column: "c" });

    await expect(
      openEnvelope(key, envelope, { ...binding, table: "a", column: "bc" }),
    ).rejects.toThrow();
  });

  it("refuses to open without a binding", async () => {
    const key = await generateKey();
    await expect(openEnvelope(key, await seal(key))).rejects.toThrow(/binding/);
  });

  it("still opens -v1 values with no binding, ignoring one if given", async () => {
    const key = await generateKey();
    const envelope = await sealEnvelope(key, new TextEncoder().encode("old"));

    expect(new TextDecoder().decode(await openEnvelope(key, envelope))).toBe(
      "old",
    );
    expect(
      new TextDecoder().decode(await openEnvelope(key, envelope, binding)),
    ).toBe("old");
  });
});

describe("tamper error", () => {
  it("is raised, and distinct from a plain failure, when a row-bound value fails to open", async () => {
    const key = new Uint8Array(32).fill(3);
    const binding = {
      userId: "u",
      table: "tasks",
      column: "content",
      rowId: "a",
    };
    const sealed = await sealEnvelope(
      key,
      new TextEncoder().encode("x"),
      undefined,
      binding,
    );

    const error = await openEnvelope(key, sealed, {
      ...binding,
      rowId: "b",
    }).catch((e: unknown) => e);

    expect(isTamperError(error)).toBe(true);
    const legacy = await sealEnvelope(key, new TextEncoder().encode("x"));
    const wrongKey = await openEnvelope(
      new Uint8Array(32).fill(4),
      legacy,
    ).catch((e: unknown) => e);
    expect(isTamperError(wrongKey)).toBe(false);
  });

  it("flags every value that is not -v2 under the current key as needing a Re-seal", async () => {
    const key = new Uint8Array(32).fill(3);
    const binding = {
      userId: "u",
      table: "tasks",
      column: "content",
      rowId: "a",
    };
    const v1 = await sealEnvelope(key, new TextEncoder().encode("x"));
    const v2 = await sealEnvelope(
      key,
      new TextEncoder().encode("x"),
      undefined,
      binding,
    );
    const v2OtherKey = await sealEnvelope(
      key,
      new TextEncoder().encode("x"),
      "2",
      binding,
    );

    expect([v1, v2OtherKey, "plain"].map(needsReseal)).toEqual([
      true,
      true,
      true,
    ]);
    expect(needsReseal(v2)).toBe(false);
  });
});
