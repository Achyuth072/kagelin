import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useUhabitsExport } from "@/lib/hooks/useUhabitsExport";

const {
  mockExportToUhabitsDb,
  mockExportToUhabitsZip,
  mockDownloadBackup,
  mockTrigger,
  mockCaptureException,
  mockNotify,
} = vi.hoisted(() => ({
  mockExportToUhabitsDb: vi.fn(),
  mockExportToUhabitsZip: vi.fn(),
  mockDownloadBackup: vi.fn(),
  mockTrigger: vi.fn(),
  mockCaptureException: vi.fn(),
  mockNotify: {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/export/uhabitsExportDb", () => ({
  exportToUhabitsDb: (...args: unknown[]) => mockExportToUhabitsDb(...args),
  generateUhabitsDbFilename: vi.fn(() => "Loop Habits Backup 2026-09-18.db"),
}));

vi.mock("@/lib/export/uhabitsExportCsv", () => ({
  exportToUhabitsZip: (...args: unknown[]) => mockExportToUhabitsZip(...args),
  generateUhabitsZipFilename: vi.fn(() => "Loop Habits CSV 2026-09-18.zip"),
}));

vi.mock("@/lib/backup/export-import", () => ({
  downloadBackup: (...args: unknown[]) => mockDownloadBackup(...args),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: mockTrigger }),
}));

vi.mock("@/lib/notify", () => ({
  notify: mockNotify,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

describe("useUhabitsExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes as not exporting", () => {
    const { result } = renderHook(() => useUhabitsExport());
    expect(result.current.isExporting).toBe(false);
  });

  it("exports Loop SQLite database and triggers download", async () => {
    const fakeDbBytes = new Uint8Array([1, 2, 3]);
    mockExportToUhabitsDb.mockResolvedValueOnce(fakeDbBytes);

    const { result } = renderHook(() => useUhabitsExport());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.exportLoopDb();
    });

    expect(success).toBe(true);
    expect(mockTrigger).toHaveBeenCalledWith("toggle");
    expect(mockTrigger).toHaveBeenCalledWith("success");
    expect(mockExportToUhabitsDb).toHaveBeenCalled();
    expect(mockDownloadBackup).toHaveBeenCalledWith(
      expect.any(Blob),
      "Loop Habits Backup 2026-09-18.db",
    );
    expect(mockNotify.success).toHaveBeenCalledWith(
      "Loop database exported",
      expect.objectContaining({ id: "toast-id" }),
    );
    expect(result.current.isExporting).toBe(false);
  });

  it("handles exportLoopDb failure with error notification and sentry report", async () => {
    mockExportToUhabitsDb.mockRejectedValueOnce(new Error("WASM failed"));

    const { result } = renderHook(() => useUhabitsExport());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.exportLoopDb();
    });

    expect(success).toBe(false);
    expect(mockTrigger).toHaveBeenCalledWith("thud");
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));
    expect(mockNotify.error).toHaveBeenCalledWith(
      "Failed to export Loop database",
      expect.objectContaining({ id: "toast-id" }),
    );
    expect(result.current.isExporting).toBe(false);
  });

  it("exports Loop CSV zip archive and triggers download", async () => {
    const fakeZipBytes = new Uint8Array([4, 5, 6]);
    mockExportToUhabitsZip.mockResolvedValueOnce(fakeZipBytes);

    const { result } = renderHook(() => useUhabitsExport());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.exportLoopZip();
    });

    expect(success).toBe(true);
    expect(mockTrigger).toHaveBeenCalledWith("toggle");
    expect(mockTrigger).toHaveBeenCalledWith("success");
    expect(mockExportToUhabitsZip).toHaveBeenCalled();
    expect(mockDownloadBackup).toHaveBeenCalledWith(
      expect.any(Blob),
      "Loop Habits CSV 2026-09-18.zip",
    );
    expect(mockNotify.success).toHaveBeenCalledWith(
      "Loop CSV archive exported",
      expect.objectContaining({ id: "toast-id" }),
    );
    expect(result.current.isExporting).toBe(false);
  });

  it("handles exportLoopZip failure with error notification and sentry report", async () => {
    mockExportToUhabitsZip.mockRejectedValueOnce(
      new Error("Zip compression error"),
    );

    const { result } = renderHook(() => useUhabitsExport());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.exportLoopZip();
    });

    expect(success).toBe(false);
    expect(mockTrigger).toHaveBeenCalledWith("thud");
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));
    expect(mockNotify.error).toHaveBeenCalledWith(
      "Failed to export Loop CSV archive",
      expect.objectContaining({ id: "toast-id" }),
    );
    expect(result.current.isExporting).toBe(false);
  });
});
