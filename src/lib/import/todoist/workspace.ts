import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { mockStore } from "@/lib/mock/mock-store";
import type { Project, Task } from "@/lib/types/task";
import type { ExistingWorkspace } from "./plan";

type WorkspaceProject = Pick<Project, "id" | "name" | "is_inbox">;
type WorkspaceTask = Pick<Task, "content" | "project_id" | "is_completed">;

export async function fetchTodoistImportWorkspace(
  isGuest: boolean,
): Promise<ExistingWorkspace> {
  if (isGuest) {
    return {
      projects: mockStore
        .getProjects()
        .filter((project) => !project.is_archived)
        .map(({ id, name, is_inbox }) => ({ id, name, is_inbox })),
      tasks: mockStore
        .getTasks()
        .filter((task) => !task.is_completed)
        .map(({ content, project_id, is_completed }) => ({
          content,
          project_id,
          is_completed,
        })),
    };
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return { projects: [], tasks: [] };
  }

  const projects = await fetchAllRows<WorkspaceProject>((from, to) =>
    supabase
      .from("projects")
      .select("id, name, is_inbox")
      .eq("is_archived", false)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const tasks = await fetchAllRows<WorkspaceTask>((from, to) =>
    supabase
      .from("tasks")
      .select("id, content, project_id, is_completed")
      .eq("is_completed", false)
      .order("id", { ascending: true })
      .range(from, to),
  );

  return { projects, tasks };
}
