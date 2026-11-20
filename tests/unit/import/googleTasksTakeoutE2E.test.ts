import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mockStore } from "@/lib/mock/mock-store";
import { parseTakeoutJson } from "@/lib/import/google-tasks/parser";
import { planGoogleTasksImport } from "@/lib/import/google-tasks/plan";
import { fetchGoogleTasksWorkspace } from "@/lib/import/google-tasks/workspace";
import { executeGoogleTasksImport } from "@/lib/import/google-tasks/importGoogleTasks";

describe("Google Tasks Guest Takeout -> mockStore End-to-End Simulation (Spec L525)", () => {
  beforeEach(() => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.clearData();
  });

  afterEach(() => {
    mockStore.clearData();
    localStorage.removeItem("kanso_guest_mode");
  });

  it("imports a Google Takeout JSON export offline into guest mockStore with full fidelity", async () => {
    const takeoutJson = JSON.stringify({
      kind: "tasks#tasks",
      items: [
        {
          id: "@default",
          title: "My Tasks",
          items: [
            {
              id: "root-1",
              title: "Buy groceries",
              notes: "Milk and bread",
              status: "needsAction",
              due: "2026-11-20T00:00:00.000Z",
              position: "00000000000000000001",
            },
            {
              id: "sub-1",
              title: "Organic Whole Milk",
              parent: "root-1",
              status: "completed",
              completed: "2026-11-19T10:00:00.000Z",
              position: "00000000000000000001",
            },
          ],
        },
        {
          id: "list-work",
          title: "Work Projects",
          items: [
            {
              id: "work-root",
              title: "Launch Kagelin v1",
              status: "needsAction",
              position: "00000000000000000001",
            },
            {
              id: "work-sub-1",
              title: "Write documentation",
              parent: "work-root",
              status: "needsAction",
              position: "00000000000000000001",
            },
            {
              id: "work-sub-deep",
              title: "API References",
              parent: "work-sub-1",
              notes: "Include examples",
              status: "needsAction",
              position: "00000000000000000001",
            },
          ],
        },
      ],
    });

    // 1. Parse Takeout JSON
    const dataset = parseTakeoutJson(takeoutJson);
    expect(dataset.lists).toHaveLength(2);

    // 2. Fetch workspace offline (empty mockStore)
    const workspace = await fetchGoogleTasksWorkspace(true);
    expect(workspace.tasks).toHaveLength(0);

    // 3. Plan import
    const preview = planGoogleTasksImport(dataset, workspace);
    expect(preview.totalTasks).toBe(5);
    expect(preview.rootTasksCount).toBe(2);
    expect(preview.subtasksCount).toBe(3);
    expect(preview.newProjectCount).toBe(1);

    // 4. Execute import into mockStore
    const { importedCount, createdProjectCount } =
      await executeGoogleTasksImport(preview, { isGuest: true });

    expect(importedCount).toBe(5);
    expect(createdProjectCount).toBe(1);

    // 5. Verify mockStore state
    const tasks = mockStore.getTasks();
    const projects = mockStore.getProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("Work Projects");

    expect(tasks).toHaveLength(5);

    // Check inbox root task
    const groceryTask = tasks.find((t) => t.content === "Buy groceries");
    expect(groceryTask).toBeDefined();
    expect(groceryTask?.project_id).toBeNull(); // Inbox
    expect(groceryTask?.description).toBe("Milk and bread");
    expect(groceryTask?.is_completed).toBe(false);
    expect(groceryTask?.due_date).toBe("2026-11-20T00:00:00.000Z");

    // Check inbox subtask
    const milkTask = tasks.find((t) => t.content === "Organic Whole Milk");
    expect(milkTask).toBeDefined();
    expect(milkTask?.parent_id).toBe(groceryTask?.id);
    expect(milkTask?.is_completed).toBe(true);
    expect(milkTask?.completed_at).toBe("2026-11-19T10:00:00.000Z");

    // Check work project tasks
    const workRoot = tasks.find((t) => t.content === "Launch Kagelin v1");
    expect(workRoot).toBeDefined();
    expect(workRoot?.project_id).toBe(projects[0].id);

    // Check flattened deep subtask
    const deepSub = tasks.find((t) => t.content === "API References");
    expect(deepSub).toBeDefined();
    // Reparented to root
    expect(deepSub?.parent_id).toBe(workRoot?.id);
    // Ancestry breadcrumb embedded in description
    expect(deepSub?.description).toContain(
      "[Context: Launch Kagelin v1 > Write documentation]",
    );
    expect(deepSub?.description).toContain("Include examples");
  });
});
