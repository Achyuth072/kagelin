import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { encryptField } from "@/lib/crypto/contentCipher";
import { createFakeSupabaseClient } from "../../support/fakeSupabaseClient";

const keyStoreState: {
  key: Uint8Array | null;
  retired: Record<string, Uint8Array>;
} = { key: null, retired: {} };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    loadKeyring: vi.fn(async () => ({
      keyId: "2",
      key: keyStoreState.key,
      retired: keyStoreState.retired,
    })),
  },
}));
vi.mock("@/lib/crypto/keyChainMark", () => ({
  keyChainMark: { load: vi.fn(async () => ({ keyId: 0, sealedV2: false })) },
}));

const decryptFailure = { error: null as Error | null };
vi.mock("@/lib/crypto/contentCipher", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/crypto/contentCipher")>();
  return {
    ...actual,
    decryptField: vi.fn((...args: Parameters<typeof actual.decryptField>) =>
      decryptFailure.error
        ? Promise.reject(decryptFailure.error)
        : actual.decryptField(...args),
    ),
  };
});

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;
vi.mock("@/lib/supabase/client", () => ({
  createRawClient: () => fakeClient,
}));

const { runReseal } = await import("@/lib/crypto/reseal");

const USER_ID = "user-1";
let oldKey: Uint8Array;
const sealedUnderOld = (rowId: string, text: string) =>
  encryptField(
    oldKey,
    text,
    { userId: USER_ID, table: "tasks", column: "content", rowId },
    "1",
  );

beforeEach(async () => {
  oldKey = await generateMasterKey();
  keyStoreState.key = await generateMasterKey();
  keyStoreState.retired = { "1": oldKey };
  decryptFailure.error = null;
});

describe("runReseal when opening fails for a reason other than the value", () => {
  it("fails the pass instead of reporting every value as unreadable", async () => {
    fakeClient = createFakeSupabaseClient({
      tasks: [
        {
          id: "t1",
          user_id: USER_ID,
          content: await sealedUnderOld("t1", "Buy milk"),
          updated_at: "t0",
        },
      ],
    });
    decryptFailure.error = new Error("libsodium failed to load");

    await expect(runReseal(USER_ID)).rejects.toThrow(
      "libsodium failed to load",
    );
  });

  it("keeps a pending reminder's encrypted text", async () => {
    const ciphertext = await sealedUnderOld("t1", "Buy milk");
    fakeClient = createFakeSupabaseClient({
      notification_queue: [
        {
          id: "n1",
          user_id: USER_ID,
          type: "due_date",
          status: "pending",
          payload: {
            encrypted: { template: "Scheduled: {}", ciphertext },
            data: { taskId: "t1", reminderType: "do_date" },
          },
        },
      ],
    });
    decryptFailure.error = new Error("libsodium failed to load");

    await expect(runReseal(USER_ID)).rejects.toThrow();
    expect(
      fakeClient.rawRows("notification_queue")[0].payload.encrypted.ciphertext,
    ).toBe(ciphertext);
  });
});
