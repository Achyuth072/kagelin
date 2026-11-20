import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGoogleTasksImport } from "@/lib/hooks/useGoogleTasksImport";
import * as adapter from "@/lib/import/google-tasks/adapter";
import * as importModule from "@/lib/import/google-tasks/importGoogleTasks";
import * as workspaceModule from "@/lib/import/google-tasks/workspace";
import * as telemetry from "@/lib/telemetry/client";
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

describe("useGoogleTasksImport", () => {
  const sampleTakeoutJson = JSON.stringify({
    kind: "tasks#tasks",
    items: [
      {
        id: "list-1",
        title: "Work",
        items: [
          {
            id: "task-1",
            title: "Task 1",
            status: "needsAction",
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(workspaceModule, "fetchGoogleTasksWorkspace").mockResolvedValue({
      projects: [],
      tasks: [],
    });
  });

  it("initializes with idle state and null preview", () => {
    const { result } = renderHook(() => useGoogleTasksImport());

    expect(result.current.state).toBe("idle");
    expect(result.current.preview).toBeNull();
    expect(result.current.isImporting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("prepares Takeout import and updates state to previewing", async () => {
    const { result } = renderHook(() => useGoogleTasksImport());
    const file = new File([sampleTakeoutJson], "Tasks.json", {
      type: "application/json",
    });

    let previewResult: unknown;
    await act(async () => {
      previewResult = await result.current.prepareTakeoutImport(file);
    });

    expect(previewResult).not.toBeNull();
    expect(result.current.state).toBe("previewing");
    expect(result.current.preview).not.toBeNull();
    expect(result.current.preview?.totalTasks).toBe(1);
    expect(telemetry.trackTelemetry).toHaveBeenCalledWith(
      "migration_event",
      expect.objectContaining({
        source: "google_tasks",
        ingress: "takeout_json",
        phase: "plan",
        status: "completed",
        task_count: 1,
      }),
    );
  });

  it("prepares OAuth import with token and updates state to previewing", async () => {
    vi.spyOn(adapter, "fetchGoogleTasksDataset").mockResolvedValue({
      lists: [{ id: "list-1", title: "Personal" }],
      tasksByListId: {
        "list-1": [
          {
            id: "t1",
            title: "Buy milk",
            status: "needsAction",
          },
        ],
      },
    });

    const { result } = renderHook(() => useGoogleTasksImport());

    let previewResult: unknown;
    await act(async () => {
      previewResult =
        await result.current.prepareOAuthImport("mock-oauth-token");
    });

    expect(previewResult).not.toBeNull();
    expect(result.current.state).toBe("previewing");
    expect(result.current.preview?.totalTasks).toBe(1);
    expect(telemetry.trackTelemetry).toHaveBeenCalledWith(
      "migration_event",
      expect.objectContaining({
        source: "google_tasks",
        ingress: "oauth",
        phase: "plan",
        status: "completed",
        task_count: 1,
      }),
    );
  });

  it("commits import, invalidates query cache, calls notifyLocalEdit, and resets to idle", async () => {
    vi.spyOn(importModule, "executeGoogleTasksImport").mockResolvedValue({
      importedCount: 1,
      createdProjectCount: 1,
    });

    const { result } = renderHook(() => useGoogleTasksImport());
    const file = new File([sampleTakeoutJson], "Tasks.json", {
      type: "application/json",
    });

    await act(async () => {
      await result.current.prepareTakeoutImport(file);
    });

    let commitSuccess = false;
    await act(async () => {
      commitSuccess = await result.current.commitImport();
    });

    expect(commitSuccess).toBe(true);
    expect(result.current.state).toBe("idle");
    expect(result.current.preview).toBeNull();

    // Verification of required query invalidations
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["tasks"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["calendar-tasks"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["projects"],
    });

    // Verification of local edit notification
    expect(syncScheduler.notifyLocalEdit).toHaveBeenCalledTimes(1);

    // Verification of telemetry
    expect(telemetry.trackTelemetry).toHaveBeenCalledWith(
      "migration_event",
      expect.objectContaining({
        source: "google_tasks",
        ingress: "takeout_json",
        phase: "commit",
        status: "completed",
        task_count: 1,
      }),
    );
    expect(notify.success).toHaveBeenCalled();
  });

  it("handles commit failure by transitioning to error state and recording diagnostic", async () => {
    vi.spyOn(importModule, "executeGoogleTasksImport").mockRejectedValue(
      new Error("Mutation failure"),
    );

    const { result } = renderHook(() => useGoogleTasksImport());
    const file = new File([sampleTakeoutJson], "Tasks.json", {
      type: "application/json",
    });

    await act(async () => {
      await result.current.prepareTakeoutImport(file);
    });

    let commitSuccess = true;
    await act(async () => {
      commitSuccess = await result.current.commitImport();
    });

    expect(commitSuccess).toBe(false);
    expect(result.current.state).toBe("error");
    expect(notify.error).toHaveBeenCalled();
  });

  it("cancels import cleanly and resets state to idle", async () => {
    const { result } = renderHook(() => useGoogleTasksImport());
    const file = new File([sampleTakeoutJson], "Tasks.json", {
      type: "application/json",
    });

    await act(async () => {
      await result.current.prepareTakeoutImport(file);
    });

    expect(result.current.preview).not.toBeNull();

    act(() => {
      result.current.cancelImport();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.preview).toBeNull();
  });

  it("aborts in-flight commit on cancelImport", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.spyOn(importModule, "executeGoogleTasksImport").mockImplementation(
      async (_preview, options) => {
        capturedSignal = options?.signal;
        // Simulate waiting for an abort
        return new Promise((_, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(new Error("Import aborted by user"));
          });
        });
      },
    );

    const { result } = renderHook(() => useGoogleTasksImport());
    const file = new File([sampleTakeoutJson], "Tasks.json", {
      type: "application/json",
    });

    await act(async () => {
      await result.current.prepareTakeoutImport(file);
    });

    // Start commit
    let commitPromise: Promise<boolean>;
    act(() => {
      commitPromise = result.current.commitImport();
    });

    expect(result.current.state).toBe("importing");
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    // Cancel while importing
    await act(async () => {
      result.current.cancelImport();
      await commitPromise;
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.state).toBe("idle");
  });
});
