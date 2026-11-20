import {
  type GoogleTasksDataset,
  type GoogleTaskListResource,
  type GoogleTaskResource,
} from "./types";

/**
 * Parses Google Takeout Tasks.json file contents safely into a normalized GoogleTasksDataset.
 *
 * Automatically assigns lists marked "@default" (or titled/named "@default") to the Inbox.
 */
export function parseTakeoutJson(jsonContent: string): GoogleTasksDataset {
  let cleanContent = jsonContent;
  // Strip UTF-8 BOM if present
  if (cleanContent.charCodeAt(0) === 0xfeff) {
    cleanContent = cleanContent.slice(1);
  }

  const trimmed = cleanContent.trim();
  if (!trimmed) {
    throw new Error("Invalid Google Takeout file: Content is empty");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid JSON: Could not parse Google Takeout Tasks file");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "Invalid Google Takeout format: Expected top-level JSON object",
    );
  }

  const root = parsed as Record<string, unknown>;
  const rawLists = Array.isArray(root.items) ? root.items : null;

  if (!rawLists) {
    throw new Error(
      "Invalid Google Takeout format: Missing 'items' list array",
    );
  }

  const lists: GoogleTaskListResource[] = [];
  const tasksByListId: Record<string, GoogleTaskResource[]> = {};

  for (const rawList of rawLists) {
    if (!rawList || typeof rawList !== "object") continue;
    const listObj = rawList as Record<string, unknown>;

    const rawId = typeof listObj.id === "string" ? listObj.id.trim() : "";
    const rawName = typeof listObj.name === "string" ? listObj.name.trim() : "";
    const rawTitle =
      typeof listObj.title === "string" ? listObj.title.trim() : "";

    const isDefault =
      rawId === "@default" || rawName === "@default" || rawTitle === "@default";

    const listId = isDefault
      ? "@default"
      : rawId || rawName || rawTitle || crypto.randomUUID();

    let title = rawTitle || rawName;
    if (isDefault) {
      title = !title || title === "@default" ? "Inbox" : title;
    } else if (!title) {
      title = "Untitled List";
    }

    lists.push({
      id: listId,
      title,
      updated:
        typeof listObj.updated === "string" ? listObj.updated : undefined,
    });

    const tasks: GoogleTaskResource[] = [];
    const rawItems = Array.isArray(listObj.items) ? listObj.items : [];

    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const itemObj = rawItem as Record<string, unknown>;

      // Filter out deleted items (Google Tasks tombstones)
      if (itemObj.deleted === true) {
        continue;
      }

      const taskId =
        typeof itemObj.id === "string" && itemObj.id.trim()
          ? itemObj.id.trim()
          : crypto.randomUUID();

      const taskTitle = typeof itemObj.title === "string" ? itemObj.title : "";

      const notes =
        typeof itemObj.notes === "string" ? itemObj.notes : undefined;

      const due = typeof itemObj.due === "string" ? itemObj.due : undefined;

      const status =
        itemObj.status === "completed" ? "completed" : "needsAction";

      const completed =
        typeof itemObj.completed === "string" ? itemObj.completed : undefined;

      const parent =
        typeof itemObj.parent === "string" && itemObj.parent.trim()
          ? itemObj.parent.trim()
          : undefined;

      const position =
        typeof itemObj.position === "string" ? itemObj.position : undefined;

      tasks.push({
        id: taskId,
        title: taskTitle,
        notes,
        due,
        status,
        completed,
        parent,
        position,
        deleted: false,
        hidden: itemObj.hidden === true,
      });
    }

    tasksByListId[listId] = tasks;
  }

  return {
    lists,
    tasksByListId,
  };
}
