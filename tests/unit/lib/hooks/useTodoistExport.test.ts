import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTodoistExport } from "@/lib/hooks/useTodoistExport";
import * as todoistExportMod from "@/lib/export/todoistExport";
import * as exportImportMod from "@/lib/backup/export-import";
import { notify } from "@/lib/notify";

const mockTrigger = vi.fn();
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: mockTrigger }),
}));

let mockIsGuest = false;
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: mockIsGuest }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    loading: vi.fn(() => "loading-toast-id"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/backup/export-import", () => ({
  downloadBackup: vi.fn(),
}));

describe("useTodoistExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGuest = false;
  });

  it("successfully triggers export in registered mode", async () => {
    const exportSpy = vi
      .spyOn(todoistExportMod, "exportToTodoistZip")
      .mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    vi.spyOn(
      todoistExportMod,
      "generateTodoistExportFilename",
    ).mockReturnValueOnce("Todoist Export 2025-05-01.zip");

    const { result } = renderHook(() => useTodoistExport());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.exportTodoistZip();
    });

    expect(success).toBe(true);
    expect(mockTrigger).toHaveBeenCalledWith("toggle");
    expect(notify.loading).toHaveBeenCalledWith("Exporting Todoist archive...");
    expect(exportSpy).toHaveBeenCalledWith({ isGuest: false });
    expect(exportImportMod.downloadBackup).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith("Todoist archive exported", {
      id: "loading-toast-id",
    });
    expect(mockTrigger).toHaveBeenCalledWith("success");
    expect(result.current.isExporting).toBe(false);
  });

  it("passes isGuest = true when user is in guest mode", async () => {
    mockIsGuest = true;
    const exportSpy = vi
      .spyOn(todoistExportMod, "exportToTodoistZip")
      .mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

    const { result } = renderHook(() => useTodoistExport());

    await act(async () => {
      await result.current.exportTodoistZip();
    });

    expect(exportSpy).toHaveBeenCalledWith({ isGuest: true });
  });

  it("handles export failure gracefully", async () => {
    vi.spyOn(todoistExportMod, "exportToTodoistZip").mockRejectedValueOnce(
      new Error("Network or export error"),
    );

    const { result } = renderHook(() => useTodoistExport());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.exportTodoistZip();
    });

    expect(success).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(
      "Failed to export Todoist archive",
      { id: "loading-toast-id" },
    );
    expect(mockTrigger).toHaveBeenCalledWith("thud");
    expect(result.current.isExporting).toBe(false);
  });
});
