import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { mockStore } from "@/lib/mock/mock-store";
import type {
  ExistingWorkspace,
  WorkspaceProject,
  WorkspaceTask,
} from "./types";

export async function fetchGoogleTasksWorkspace(
  isGuest: boolean,
): Promise<ExistingWorkspace> {
  if (isGuest) {
    const projects: WorkspaceProject[] = mockStore
      .getProjects()
      .filter((project) => !project.is_archived)
      .map(({ id, name, is_inbox }) => ({ id, name: name ?? "", is_inbox }));

    const tasks: WorkspaceTask[] = mockStore
      .getTasks()
      .filter((task) => !task.is_completed)
      .map(({ id, content, project_id, parent_id, is_completed }) => ({
        id,
        content,
        project_id,
        parent_id,
        is_completed,
      }));

    return { projects, tasks };
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return { projects: [], tasks: [] };
  }

  const [rawProjects, tasks] = await Promise.all([
    fetchAllRows<{ id: string; name: string | null; is_inbox: boolean }>(
      (from, to) =>
        supabase
          .from("projects")
          .select("id, name, is_inbox")
          .eq("is_archived", false)
          .order("id", { ascending: true })
          .range(from, to),
    ),
    fetchAllRows<WorkspaceTask>((from, to) =>
      supabase
        .from("tasks")
        .select("id, content, project_id, parent_id, is_completed")
        .eq("is_completed", false)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const projects: WorkspaceProject[] = rawProjects.map(
    ({ id, name, is_inbox }) => ({
      id,
      name: name ?? "",
      is_inbox,
    }),
  );

  return { projects, tasks };
}
