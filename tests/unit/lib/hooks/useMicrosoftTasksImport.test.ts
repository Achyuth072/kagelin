import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMicrosoftTasksImport } from "@/lib/hooks/useMicrosoftTasksImport";
import * as adapter from "@/lib/import/microsoft-tasks/adapter";
import * as executor from "@/lib/import/microsoft-tasks/executor";
import * as workspaceModule from "@/lib/import/microsoft-tasks/workspace";
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

describe("useMicrosoftTasksImport", () => {
  const sampleGraphJson = JSON.stringify({
    lists: [
      {
        id: "list-1",
        displayName: "Work",
        tasks: [
          {
            id: "task-1",
            title: "Task 1",
            status: "notStarted",
            checklistItems: [
              { id: "step-1", displayName: "Step 1", isChecked: false },
            ],
          },
        ],
      },
    ],
  });

  const sampleOutlookCsv = `Subject,Start Date,Due Date,Status,Priority,% Complete,Categories,Description
"Buy groceries","11/21/2026","11/22/2026","Not Started","High","0%","Personal","Need apples"`;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(workspaceModule, "fetchMicrosoftTasksWorkspace").mockResolvedValue(
      {
        projects: [],
        tasks: [],
      },
    );
  });

  it("initializes with idle state and null preview", () => {
    const { result } = renderHook(() => useMicrosoftTasksImport());

    expect(result.current.state).toBe("idle");
    expect(result.current.preview).toBeNull();
    expect(result.current.isImporting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("prepares JSON file import and updates state to previewing", async () => {
    const { result } = renderHook(() => useMicrosoftTasksImport());
    const file = new File([sampleGraphJson], "MicrosoftTasks.json", {
      type: "application/json",
    });

    let previewResult: unknown;
    await act(async () => {
      previewResult = await result.current.prepareFileImport(file);
    });

    expect(previewResult).not.toBeNull();
    expect(result.current.state).toBe("previewing");
    expect(result.current.preview).not.toBeNull();
    expect(result.current.preview?.totalTasks).toBe(1);
    expect(result.current.preview?.totalSteps).toBe(1);
    expect(telemetry.trackTelemetry).toHaveBeenCalledWith(
      "migration_event",
      expect.objectContaining({
        source: "microsoft_tasks",
        ingress: "json_file",
        phase: "plan",
        status: "completed",
        task_count: 1,
      }),
    );
  });

  it("prepares CSV file import and updates state to previewing", async () => {
    const { result } = renderHook(() => useMicrosoftTasksImport());
    const file = new File([sampleOutlookCsv], "OutlookTasks.csv", {
      type: "text/csv",
    });

    let previewResult: unknown;
    await act(async () => {
      previewResult = await result.current.prepareFileImport(file);
    });

    expect(previewResult).not.toBeNull();
    expect(result.current.state).toBe("previewing");
    expect(result.current.preview?.totalTasks).toBe(1);
    expect(telemetry.trackTelemetry).toHaveBeenCalledWith(
      "migration_event",
      expect.objectContaining({
        source: "microsoft_tasks",
        ingress: "csv_file",
        phase: "plan",
        status: "completed",
      }),
    );
  });

  it("prepares OAuth import when token is provided", async () => {
    vi.spyOn(adapter, "fetchMicrosoftTasksDataset").mockResolvedValue({
      lists: [
        {
          id: "list-oauth",
          displayName: "OAuth Tasks",
          isOwner: true,
          isShared: false,
          wellknownListName: "defaultList",
          tasks: [],
        },
      ],
      tasksByListId: {
        "list-oauth": [
          {
            id: "task-oauth-1",
            title: "OAuth Task",
            importance: "normal",
            status: "notStarted",
            isReminderOn: false,
            checklistItems: [],
          },
        ],
      },
    });

    const { result } = renderHook(() => useMicrosoftTasksImport());

    await act(async () => {
      await result.current.prepareOAuthImport("mock-bearer-token");
    });

    expect(result.current.state).toBe("previewing");
    expect(result.current.preview?.totalTasks).toBe(1);
    expect(adapter.fetchMicrosoftTasksDataset).toHaveBeenCalledWith(
      "mock-bearer-token",
    );
  });

  it("commits import successfully, invalidates queries, and resets state", async () => {
    vi.spyOn(executor, "executeMicrosoftTasksImport").mockResolvedValue({
      importedCount: 5,
      createdProjectCount: 1,
    });

    const { result } = renderHook(() => useMicrosoftTasksImport());
    const file = new File([sampleGraphJson], "MicrosoftTasks.json", {
      type: "application/json",
    });

    await act(async () => {
      await result.current.prepareFileImport(file);
    });

    let commitSuccess = false;
    await act(async () => {
      commitSuccess = await result.current.commitImport();
    });

    expect(commitSuccess).toBe(true);
    expect(executor.executeMicrosoftTasksImport).toHaveBeenCalled();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["tasks"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["calendar-tasks"],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["projects"],
    });
    expect(syncScheduler.notifyLocalEdit).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
    expect(result.current.preview).toBeNull();
  });
});
