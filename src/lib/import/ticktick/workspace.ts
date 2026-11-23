import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { mockStore } from "@/lib/mock/mock-store";
import type {
  ExistingWorkspace,
  WorkspaceProject,
  WorkspaceTask,
} from "./types";

export async function fetchTickTickWorkspace(
  isGuest: boolean,
): Promise<ExistingWorkspace> {
  if (isGuest) {
    const projects: WorkspaceProject[] = mockStore
      .getProjects()
      .filter((project) => !project.is_archived)
      .map(({ id, name, is_inbox }) => ({ id, name: name ?? "", is_inbox }));

    const tasks: WorkspaceTask[] = mockStore
      .getTasks()
      .map(
        ({
          id,
          content,
          project_id,
          parent_id,
          is_completed,
          due_date,
          do_date,
        }) => ({
          id,
          content: content ?? "",
          project_id,
          parent_id,
          is_completed,
          due_date,
          do_date,
        }),
      );

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
        .select(
          "id, content, project_id, parent_id, is_completed, due_date, do_date",
        )
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
