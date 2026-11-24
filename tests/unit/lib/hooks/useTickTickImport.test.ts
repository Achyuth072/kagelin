import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTickTickImport } from "@/lib/hooks/useTickTickImport";
import * as importModule from "@/lib/import/ticktick/importTickTick";
import * as workspaceModule from "@/lib/import/ticktick/workspace";
import * as syncScheduler from "@/lib/sync/sync-scheduler";
import { notify } from "@/lib/notify";

const invalidateQueriesMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false, user: { id: "test-user-id" } }),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    loading: vi.fn(() => "loading-toast-id"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/sync/sync-scheduler", () => ({
  notifyLocalEdit: vi.fn(),
}));

vi.mock("@/lib/telemetry/client", () => ({
  trackTelemetry: vi.fn(),
}));

describe("useTickTickImport (React Hook Lifecycle)", () => {
  const sampleTickTickCsv = `Folder Name,List Name,Title,Tags,Content,Is Check list,Start Date,Due Date,Reminder,Repeat,Priority,Status,Created Time,Completed Time,Order,Timezone,Is All Day,Is Floating,Column Name,Column Order,View Mode,taskId,parentId
,"Work","Launch Product","tag1","Product details","0","2026-11-20 09:00:00","2026-11-20 17:00:00","","","5","0","2026-11-01 10:00:00","","1","UTC","0","0","","0","","tt-task-1",""
`;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(workspaceModule, "fetchTickTickWorkspace").mockResolvedValue({
      projects: [],
      tasks: [],
    });
  });

  it("initializes with idle state and null preview", () => {
    const { result } = renderHook(() => useTickTickImport());

    expect(result.current.state).toBe("idle");
    expect(result.current.preview).toBeNull();
    expect(result.current.isImporting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("prepares import and transitions to previewing state", async () => {
    const { result } = renderHook(() => useTickTickImport());
    const file = new File([sampleTickTickCsv], "backup.csv", {
      type: "text/csv",
    });

    let previewResult: unknown;
    await act(async () => {
      previewResult = await result.current.prepareImport(file);
    });

    expect(previewResult).not.toBeNull();
    expect(result.current.state).toBe("previewing");
    expect(result.current.preview).not.toBeNull();
    expect(result.current.preview?.totalTasks).toBe(1);
    expect(result.current.preview?.projects[0].name).toBe("Work");
  });

  it("commits import, invalidates query cache, and triggers local sync notifications", async () => {
    vi.spyOn(importModule, "executeTickTickImport").mockResolvedValue({
      importedCount: 1,
      createdProjectCount: 1,
    });

    const { result } = renderHook(() => useTickTickImport());
    const file = new File([sampleTickTickCsv], "backup.csv", {
      type: "text/csv",
    });

    await act(async () => {
      await result.current.prepareImport(file);
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.commitImport();
    });

    expect(success).toBe(true);
    expect(importModule.executeTickTickImport).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["tasks"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["calendar-tasks"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["projects"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["subtasks"],
    });
    expect(syncScheduler.notifyLocalEdit).toHaveBeenCalledTimes(1);
    expect(notify.success).toHaveBeenCalled();
    expect(result.current.preview).toBeNull();
    expect(result.current.state).toBe("idle");
  });

  it("cancels import and resets state", async () => {
    const { result } = renderHook(() => useTickTickImport());
    const file = new File([sampleTickTickCsv], "backup.csv", {
      type: "text/csv",
    });

    await act(async () => {
      await result.current.prepareImport(file);
    });

    expect(result.current.preview).not.toBeNull();

    act(() => {
      result.current.cancelImport();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.preview).toBeNull();
  });

  it("handles empty files gracefully by notifying and returning null", async () => {
    const { result } = renderHook(() => useTickTickImport());
    const file = new File([""], "empty.csv", { type: "text/csv" });

    let previewResult: unknown;
    await act(async () => {
      previewResult = await result.current.prepareImport(file);
    });

    expect(previewResult).toBeNull();
    expect(notify.error).toHaveBeenCalledWith(
      "No valid tasks found in TickTick import",
    );
    expect(result.current.preview).toBeNull();
  });
});
