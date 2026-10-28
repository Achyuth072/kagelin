import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import {
  recordDiagnosticError,
  getDiagnosticErrors,
  clearDiagnosticErrors,
  exportDiagnosticReport,
  getExtendedSystemInfo,
  MAX_DIAGNOSTIC_ERRORS,
} from "@/lib/errors/diagnostics";
import { REDACTED } from "@/lib/errors/scrubEvent";

const mockDb = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => mockDb.get(key)),
  set: vi.fn(async (key: string, val: unknown) => {
    mockDb.set(key, val);
  }),
  del: vi.fn(async (key: string) => {
    mockDb.delete(key);
  }),
}));

describe("src/lib/errors/diagnostics.ts", () => {
  beforeEach(async () => {
    mockDb.clear();
    await clearDiagnosticErrors();
  });

  it("redacts sensitive error messages by default", async () => {
    const error = new Error("Failed to save 'Secret habit title'");
    await recordDiagnosticError(error);

    const records = await getDiagnosticErrors();
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe("Error");
    expect(records[0].message).toBe(REDACTED);
    expect(records[0].message).not.toContain("Secret");
  });

  it("allows safe exception messages to survive", async () => {
    const error = new Error("Failed to fetch");
    await recordDiagnosticError(error);

    const records = await getDiagnosticErrors();
    expect(records).toHaveLength(1);
    expect(records[0].message).toBe("Failed to fetch");
  });

  it("scrubs the first line of the stack trace and query parameters from URLs", async () => {
    const error = new Error("Secret user password leaked");
    error.name = "TypeError";
    error.stack = [
      "TypeError: Secret user password leaked",
      "    at Component (https://kagelin.app/_next/static/chunks/app.js?token=secret123:42:15)",
      "    at renderWithHooks (https://kagelin.app/_next/static/chunks/main.js:100:2)",
    ].join("\n");

    await recordDiagnosticError(error);

    const records = await getDiagnosticErrors();
    expect(records).toHaveLength(1);
    const stack = records[0].stack;
    expect(stack).toBeDefined();
    expect(stack).not.toContain("Secret user password leaked");
    expect(stack).not.toContain("token=secret123");
    expect(stack).toContain("TypeError: [redacted]");
    expect(stack).toContain(
      "https://kagelin.app/_next/static/chunks/app.js:42:15",
    );
  });

  it("preserves Next.js digest and scrubs context safely", async () => {
    const error = Object.assign(new Error("Crash"), {
      digest: "NEXT_NOT_FOUND",
    });
    await recordDiagnosticError(error, {
      source: "error-boundary",
      route: "https://kagelin.app/tasks?query=sensitive-title",
      status: 404,
      arbitraryData: "should-be-omitted-or-redacted",
    });

    const records = await getDiagnosticErrors();
    expect(records).toHaveLength(1);
    expect(records[0].digest).toBe("NEXT_NOT_FOUND");
    expect(records[0].context).toEqual({
      source: "error-boundary",
      route: "https://kagelin.app/tasks",
      status: 404,
    });
  });

  it("caps records at 30 items FIFO", async () => {
    for (let i = 1; i <= 35; i++) {
      const err = new Error(`Safe error ${i}`);
      await recordDiagnosticError(err, { count: i });
    }

    const records = await getDiagnosticErrors();
    expect(records).toHaveLength(MAX_DIAGNOSTIC_ERRORS);
    expect(MAX_DIAGNOSTIC_ERRORS).toBe(30);
    // The oldest 5 should have been pruned
    expect(records[0].context).toEqual({ count: 6 });
    expect(records[records.length - 1].context).toEqual({ count: 35 });
  });

  it("clears diagnostic errors cleanly", async () => {
    await recordDiagnosticError(new Error("test"));
    expect(await getDiagnosticErrors()).toHaveLength(1);

    await clearDiagnosticErrors();
    expect(await getDiagnosticErrors()).toHaveLength(0);
  });

  it("exports markdown report suitable for GitHub bug reports", async () => {
    await recordDiagnosticError(new Error("Failed to fetch"), {
      source: "network",
    });

    const report = await exportDiagnosticReport();
    expect(report).toContain("### Kagelin Diagnostic Report");
    expect(report).toContain("#### System Information");
    expect(report).toContain("App Version");
    expect(report).toContain("#### Error Log (1 event)");
    expect(report).toContain("Failed to fetch");
    expect(report).toContain('{"source":"network"}');
    expect(report).not.toContain("IndexedDB persistence failed");
  });

  it("handles export when no errors are logged", async () => {
    const report = await exportDiagnosticReport();
    expect(report).toContain("### Kagelin Diagnostic Report");
    expect(report).toContain("*No diagnostic errors recorded.*");
  });

  it("does not throw if storage fails", async () => {
    const { set } = await import("idb-keyval");
    vi.mocked(set).mockRejectedValueOnce(new Error("IndexedDB quota exceeded"));

    await expect(
      recordDiagnosticError(new Error("Something")),
    ).resolves.not.toThrow();
  });

  it("notes IndexedDB unavailability in the report after storage failures", async () => {
    const { set } = await import("idb-keyval");
    vi.mocked(set).mockRejectedValueOnce(new Error("IndexedDB quota exceeded"));

    await recordDiagnosticError(new Error("Persist failed"));

    const report = await exportDiagnosticReport(new Error("Failed to fetch"));
    expect(report).toContain("IndexedDB persistence failed");
    expect(report).toContain("Failed to fetch");
  });

  describe("getExtendedSystemInfo & exportDiagnosticReport extended fields", () => {
    const originalStorage = navigator.storage;
    const originalServiceWorker = navigator.serviceWorker;

    beforeEach(() => {
      // Clean navigator mocks
      Object.defineProperty(navigator, "storage", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(navigator, "serviceWorker", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    });

    afterAll(() => {
      Object.defineProperty(navigator, "storage", {
        value: originalStorage,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(navigator, "serviceWorker", {
        value: originalServiceWorker,
        configurable: true,
        writable: true,
      });
    });

    it("gathers storage quota and service worker status when APIs are available", async () => {
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 14.2 * 1024 * 1024,
            quota: 2048 * 1024 * 1024,
          }),
          persisted: vi.fn().mockResolvedValue(true),
        },
        configurable: true,
      });

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          controller: {
            state: "activated",
          },
        },
        configurable: true,
      });

      const sys = await getExtendedSystemInfo({
        tier: "registered",
        pendingMutationsCount: 2,
      });

      expect(sys.tier).toBe("registered");
      expect(sys.storage).toEqual({
        usageMb: 14.2,
        quotaMb: 2048,
        percentUsed: 0.7,
        persisted: true,
      });
      expect(sys.serviceWorker).toEqual({
        controllerActive: true,
        state: "activated",
      });
      expect(sys.syncHealth).toEqual({
        pendingMutationsCount: 2,
      });
    });

    it("gracefully degrades when navigator.storage and serviceWorker are undefined or reject", async () => {
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn().mockRejectedValue(new Error("Permission denied")),
          persisted: vi
            .fn()
            .mockRejectedValue(new Error("Storage unavailable")),
        },
        configurable: true,
      });

      const sys = await getExtendedSystemInfo();

      expect(sys.storage).toBeUndefined();
      expect(sys.serviceWorker).toEqual({
        controllerActive: false,
      });
      expect(sys.syncHealth).toEqual({
        pendingMutationsCount: 0,
      });
    });

    it("renders storage, service worker, tier, and pending offline mutations in the markdown report", async () => {
      Object.defineProperty(navigator, "storage", {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 14.2 * 1024 * 1024,
            quota: 2048 * 1024 * 1024,
          }),
          persisted: vi.fn().mockResolvedValue(true),
        },
        configurable: true,
      });

      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          controller: {
            state: "activated",
          },
        },
        configurable: true,
      });

      const report = await exportDiagnosticReport(undefined, {
        tier: "registered",
        pendingMutationsCount: 0,
      });

      expect(report).toContain("- **Tier:** `registered`");
      expect(report).toContain(
        "- **Storage:** `14.2 MB / 2048 MB (0.7% used, persistent)`",
      );
      expect(report).toContain("- **Service Worker:** `active (activated)`");
      expect(report).toContain("- **Pending Offline Mutations:** `0`");
    });

    it("renders fallback values in markdown report when storage is unavailable and no SW controller", async () => {
      const report = await exportDiagnosticReport(undefined, {
        tier: "guest",
        pendingMutationsCount: 5,
      });

      expect(report).toContain("- **Tier:** `guest`");
      expect(report).toContain("- **Storage:** `unavailable`");
      expect(report).toContain("- **Service Worker:** `none`");
      expect(report).toContain("- **Pending Offline Mutations:** `5`");
    });

    it("falls back to unknown tier when options are not provided", async () => {
      const report = await exportDiagnosticReport();
      expect(report).toContain("- **Tier:** `unknown`");
    });
  });
});
