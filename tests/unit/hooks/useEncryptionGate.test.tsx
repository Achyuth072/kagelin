import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const authState = {
  user: { id: "user-1" } as { id: string } | null,
  loading: false,
  isGuestMode: false,
};

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => authState,
}));

const getEncryptionKeyRowMock = vi.fn();
vi.mock("@/lib/crypto/keyManager", () => ({
  getEncryptionKeyRow: (...args: unknown[]) => getEncryptionKeyRowMock(...args),
}));

const keyStoreLoadMock = vi.fn();
const keyStoreSaveMock = vi.fn();
let keyStoreKeyId = "1";
let keyStoreFreshKeyId: string | null = null;
let keyStoreRetired: Record<string, Uint8Array> = {};
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: (...args: unknown[]) => keyStoreLoadMock(...args),
    loadKeyring: async (...args: unknown[]) => {
      const key = await keyStoreLoadMock(...args);
      const fresh = (args[1] as { fresh?: boolean } | undefined)?.fresh;
      const keyId = (fresh && keyStoreFreshKeyId) || keyStoreKeyId;
      return key ? { keyId, key, retired: keyStoreRetired } : null;
    },
    save: (...args: unknown[]) => keyStoreSaveMock(...args),
  },
}));

const purgeDeviceContentMock = vi.fn();
vi.mock("@/lib/crypto/purge", () => ({
  purgeDeviceContent: (...args: unknown[]) => purgeDeviceContentMock(...args),
}));

const notifyErrorMock = vi.fn();
vi.mock("@/lib/notify", () => ({
  notify: { error: (...args: unknown[]) => notifyErrorMock(...args) },
}));

const uiState = { autoLockEnabled: false, autoLockMinutes: 60 };
vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: (selector: (s: typeof uiState) => unknown) => selector(uiState),
}));

const getIdleMsMock = vi.fn(() => 0);
const recordActivityMock = vi.fn();
vi.mock("@/lib/crypto/autoLock", () => ({
  getIdleMs: () => getIdleMsMock(),
  recordActivity: () => recordActivityMock(),
  shouldAutoLockNow: (
    autoLock: { enabled: boolean; minutes: number },
    wouldUnlock: boolean,
  ) =>
    wouldUnlock &&
    autoLock.enabled &&
    getIdleMsMock() >= Math.max(1, autoLock.minutes) * 60_000,
}));

vi.mock("@/lib/hooks/useAutoLockTimer", () => ({
  useAutoLockTimer: () => {},
}));

import { useEncryptionGate } from "@/lib/hooks/useEncryptionGate";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { createFakeSupabaseClient } from "../support/fakeSupabaseClient";

function withQueryClient(children: React.ReactNode) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useEncryptionGate", () => {
  beforeEach(() => {
    keyStoreKeyId = "1";
    keyStoreFreshKeyId = null;
    keyStoreRetired = {};
    vi.clearAllMocks();
    authState.user = { id: "user-1" };
    authState.loading = false;
    authState.isGuestMode = false;
    purgeDeviceContentMock.mockResolvedValue(undefined);
    uiState.autoLockEnabled = false;
    uiState.autoLockMinutes = 60;
    getIdleMsMock.mockReturnValue(0);
  });

  it("resolves to not-applicable for a guest", async () => {
    authState.isGuestMode = true;
    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("not-applicable"));
  });

  it("resolves to not-applicable when signed out", async () => {
    authState.user = null;
    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("not-applicable"));
  });

  it("resolves to needs-setup when the account has no key row yet", async () => {
    getEncryptionKeyRowMock.mockResolvedValue(null);
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-setup"));
  });

  it("resolves to needs-unlock when a key row exists but this device has no cached key", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({ migrated_at: null });
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
  });

  it("resolves to needs-unlock when the key was rotated on another device", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      current_key_id: 2,
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    keyStoreKeyId = "1";

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
    expect(purgeDeviceContentMock).toHaveBeenCalled();
    expect(result.current.lockReason).toBe("key-changed");
  });

  it("keeps the new key when another tab on this device did the rotation", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      current_key_id: 2,
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    keyStoreFreshKeyId = "2";

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
    expect(purgeDeviceContentMock).not.toHaveBeenCalled();
  });

  it("does not check again when a token refresh replaces the user object", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      current_key_id: 1,
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const queryClient = new QueryClient();
    const { result, rerender } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));

    keyStoreLoadMock.mockResolvedValue(null);
    authState.user = { id: "user-1" };
    rerender();

    await act(async () => {});
    expect(result.current.status).toBe("unlocked");
    expect(getEncryptionKeyRowMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a key newer than a key row cached while offline", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      current_key_id: 1,
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    keyStoreKeyId = "2";

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
    expect(purgeDeviceContentMock).not.toHaveBeenCalled();
  });

  it("drops local copies of retired keys another device's Re-seal deleted", async () => {
    const key = new Uint8Array([1, 2, 3]);
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      sealed_v2_at: "2026-10-07T00:00:00Z",
      current_key_id: 2,
      retired_keys: {},
    });
    keyStoreLoadMock.mockResolvedValue(key);
    keyStoreKeyId = "2";
    keyStoreRetired = { "1": new Uint8Array([9]) };

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
    expect(keyStoreSaveMock).toHaveBeenCalledWith("user-1", key, "2", {});
  });

  it("restarts a running Re-seal when a rotation begins another", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      sealed_v2_at: null,
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.resealDue).toBe(true));
    const before = result.current.resealRun;

    act(() => result.current.beginReseal());
    expect(result.current.resealDue).toBe(true);
    expect(result.current.resealRun).not.toBe(before);

    act(() => result.current.finishReseal(before));
    expect(result.current.resealDue).toBe(true);
  });

  it("keeps retired keys when the key row was cached before the column existed", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      current_key_id: 2,
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    keyStoreKeyId = "2";
    keyStoreRetired = { "1": new Uint8Array([9]) };

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
    expect(keyStoreSaveMock).not.toHaveBeenCalled();
  });

  it("starts a Re-seal on demand once unlocked, as after a rotation", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      sealed_v2_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
    expect(result.current.resealDue).toBe(false);

    act(() => result.current.beginReseal());
    expect(result.current.resealDue).toBe(true);
  });

  it("resolves to needs-migration when unlocked but the backfill hasn't completed", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({ migrated_at: null });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-migration"));
  });

  it("resolves to unlocked, not needs-migration, when a row cached before migrated_at existed comes back with the field missing", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({} as { migrated_at: null });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });

  it("resolves to needs-passphrase-reset when a recovery-code unlock flagged the row, even though the device already has the key cached", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      passphrase_reset_required: true,
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() =>
      expect(result.current.status).toBe("needs-passphrase-reset"),
    );
  });

  it("resolves to unlocked when the device already has the key cached and migration is complete", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });

  it("flags a due Re-seal while staying unlocked, and clears it when finished", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      sealed_v2_at: null,
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
    expect(result.current.resealDue).toBe(true);

    act(() => result.current.finishReseal(result.current.resealRun));
    expect(result.current.resealDue).toBe(false);
  });

  it("flags a due Re-seal while retired keys remain, even with the -v2 marker set", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
      sealed_v2_at: "2026-10-07T00:00:00Z",
      retired_keys: { "1": "wrapped" },
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));
    expect(result.current.resealDue).toBe(true);
  });

  it("does not flag a Re-seal for a row cached before the marker existed, or once it is set", async () => {
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    for (const row of [
      { migrated_at: "2026-09-04T00:00:00Z" },
      {
        migrated_at: "2026-09-04T00:00:00Z",
        sealed_v2_at: "2026-10-07T00:00:00Z",
      },
    ]) {
      getEncryptionKeyRowMock.mockResolvedValue(row);
      const { result } = renderHook(() => useEncryptionGate(), {
        wrapper: ({ children }) => withQueryClient(children),
      });
      await waitFor(() => expect(result.current.status).toBe("unlocked"));
      expect(result.current.resealDue).toBe(false);
    }
  });

  it("resolves to unavailable when the key-row check fails with nothing cached", async () => {
    getEncryptionKeyRowMock.mockRejectedValue(new Error("Failed to fetch"));
    keyStoreLoadMock.mockResolvedValue(null);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });

    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("recheck() retries a failed key-row check", async () => {
    getEncryptionKeyRowMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unavailable"));

    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    act(() => result.current.recheck());

    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });

  it("lock() purges device content and flips status to needs-unlock without a network re-check", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("unlocked"));

    getEncryptionKeyRowMock.mockClear();
    await result.current.lock();

    expect(purgeDeviceContentMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
    expect(getEncryptionKeyRowMock).not.toHaveBeenCalled();
  });

  it("locks immediately on mount when auto-lock is enabled and the device has been idle past the interval", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    uiState.autoLockEnabled = true;
    uiState.autoLockMinutes = 30;
    getIdleMsMock.mockReturnValue(31 * 60_000);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });

    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
    expect(purgeDeviceContentMock).toHaveBeenCalledTimes(1);
  });

  it("stays unlocked when auto-lock is enabled but idle time is under the interval", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    uiState.autoLockEnabled = true;
    uiState.autoLockMinutes = 30;
    getIdleMsMock.mockReturnValue(5 * 60_000);

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });

    await waitFor(() => expect(result.current.status).toBe("unlocked"));
    expect(purgeDeviceContentMock).not.toHaveBeenCalled();
  });
  it("recheck restarts the idle clock, so finishing a gate screen doesn't immediately re-lock", async () => {
    getEncryptionKeyRowMock.mockResolvedValue({
      migrated_at: "2026-09-04T00:00:00Z",
    });
    keyStoreLoadMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    uiState.autoLockEnabled = true;
    uiState.autoLockMinutes = 30;
    getIdleMsMock.mockReturnValue(31 * 60_000);
    recordActivityMock.mockImplementation(() =>
      getIdleMsMock.mockReturnValue(0),
    );

    const { result } = renderHook(() => useEncryptionGate(), {
      wrapper: ({ children }) => withQueryClient(children),
    });
    await waitFor(() => expect(result.current.status).toBe("needs-unlock"));

    act(() => result.current.recheck());

    await waitFor(() => expect(result.current.status).toBe("unlocked"));
  });

  describe("when the server refuses a write sealed with a retired key", () => {
    const rejectedWrite = () =>
      wrapSupabaseClient(
        createFakeSupabaseClient(
          {},
          {
            userId: "user-1",
            failWrite: () => ({
              message: "must be sealed with the current content key",
              hint: "content_key_retired",
            }),
          },
        ),
        FIELD_MAP,
      )
        .from("tasks")
        .insert({ id: "t1", content: "x" })
        .then(
          () => null,
          (e: unknown) => e,
        );

    async function unlockedGate(serverKeyId: number) {
      getEncryptionKeyRowMock.mockResolvedValue({
        migrated_at: "2026-09-04T00:00:00Z",
        current_key_id: serverKeyId,
      });
      keyStoreLoadMock.mockResolvedValue(await generateMasterKey());
      keyStoreKeyId = "1";
      const statuses: string[] = [];
      const hook = renderHook(
        () => {
          const gate = useEncryptionGate();
          statuses.push(gate.status);
          return gate;
        },
        { wrapper: ({ children }) => withQueryClient(children) },
      );
      await waitFor(() => expect(hook.result.current.status).toBe("unlocked"));
      statuses.length = 0;
      return { ...hook, statuses };
    }

    it("locks the device without showing the loading screen once the server key is newer", async () => {
      const { result, statuses } = await unlockedGate(1);
      getEncryptionKeyRowMock.mockResolvedValue({
        migrated_at: "2026-09-04T00:00:00Z",
        current_key_id: 2,
      });

      await act(async () => {
        await rejectedWrite();
      });

      await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
      expect(purgeDeviceContentMock).toHaveBeenCalledTimes(1);
      expect(result.current.lockReason).toBe("key-changed");
      expect(statuses).not.toContain("loading");
    });

    it("stays unlocked when another tab on this device already saved the new key", async () => {
      const { result } = await unlockedGate(1);
      getEncryptionKeyRowMock.mockResolvedValue({
        migrated_at: "2026-09-04T00:00:00Z",
        current_key_id: 2,
      });
      keyStoreFreshKeyId = "2";

      await act(async () => {
        await rejectedWrite();
      });

      expect(result.current.status).toBe("unlocked");
      expect(purgeDeviceContentMock).not.toHaveBeenCalled();
    });

    it("purges once when several writes are refused at the same time", async () => {
      const { result } = await unlockedGate(1);
      getEncryptionKeyRowMock.mockResolvedValue({
        migrated_at: "2026-09-04T00:00:00Z",
        current_key_id: 2,
      });

      await act(async () => {
        await Promise.all([rejectedWrite(), rejectedWrite(), rejectedWrite()]);
      });

      await waitFor(() => expect(result.current.status).toBe("needs-unlock"));
      expect(purgeDeviceContentMock).toHaveBeenCalledTimes(1);
    });

    it("stays unlocked when the server still has this device's key", async () => {
      const { result } = await unlockedGate(1);

      await act(async () => {
        await rejectedWrite();
      });

      expect(result.current.status).toBe("unlocked");
      expect(purgeDeviceContentMock).not.toHaveBeenCalled();
      expect(notifyErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("couldn't be saved"),
        { id: "content-key-rejected" },
      );
    });

    it("ignores the rejection while the recovery code is on screen", async () => {
      const { result } = await unlockedGate(1);
      getEncryptionKeyRowMock.mockResolvedValue({
        migrated_at: "2026-09-04T00:00:00Z",
        current_key_id: 2,
      });

      act(() => result.current.holdForRecoveryCode(true));
      await act(async () => {
        await rejectedWrite();
      });

      expect(result.current.status).toBe("unlocked");
      expect(purgeDeviceContentMock).not.toHaveBeenCalled();
      expect(notifyErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("couldn't be saved"),
        { id: "content-key-rejected" },
      );
    });
  });
});
