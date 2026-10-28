import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  recordDiagnosticError,
  getDiagnosticErrors,
  clearDiagnosticErrors,
  exportDiagnosticReport,
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
});
