import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { mockStore } from "@/lib/mock/mock-store";
import type { WorkspaceProject, WorkspaceTask } from "./types";

// One small table, so it is cheap to read.
export async function fetchTodoistImportProjects(
  isGuest: boolean,
): Promise<WorkspaceProject[]> {
  if (isGuest) {
    return mockStore
      .getProjects()
      .filter((project) => !project.is_archived)
      .map(({ id, name, is_inbox }) => ({ id, name, is_inbox }));
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return [];
  }

  return fetchAllRows<WorkspaceProject>((from, to) =>
    supabase
      .from("projects")
      .select("id, name, is_inbox")
      .eq("is_archived", false)
      .order("id", { ascending: true })
      .range(from, to),
  );
}

// Scoped so a large account does not ship every task title to build the index.
export async function fetchTodoistImportTasks(
  isGuest: boolean,
  projectIds: string[],
): Promise<WorkspaceTask[]> {
  if (isGuest) {
    const scope = new Set(projectIds);
    return mockStore
      .getTasks()
      .filter(
        (task) =>
          !task.is_completed &&
          (task.project_id === null || scope.has(task.project_id)),
      )
      .map(({ id, content, project_id, parent_id, is_completed }) => ({
        id,
        content,
        project_id,
        parent_id,
        is_completed,
      }));
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return [];
  }

  // Inbox tasks carry a null project_id; the rest are scoped to the import.
  const inboxTasks = await fetchAllRows<WorkspaceTask>((from, to) =>
    supabase
      .from("tasks")
      .select("id, content, project_id, parent_id, is_completed")
      .eq("is_completed", false)
      .is("project_id", null)
      .order("id", { ascending: true })
      .range(from, to),
  );

  if (projectIds.length === 0) return inboxTasks;

  const scopedTasks = await fetchAllRows<WorkspaceTask>((from, to) =>
    supabase
      .from("tasks")
      .select("id, content, project_id, parent_id, is_completed")
      .eq("is_completed", false)
      .in("project_id", projectIds)
      .order("id", { ascending: true })
      .range(from, to),
  );

  return [...inboxTasks, ...scopedTasks];
}
