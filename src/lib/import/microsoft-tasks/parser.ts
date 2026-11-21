import {
  type MicrosoftTasksDataset,
  type MicrosoftTaskListResource,
  type MicrosoftTaskResource,
  type MicrosoftChecklistItem,
} from "./types";

/**
 * Tokenizes CSV string into 2D string array, safely handling quotes and CRLF.
 */
function tokenizeCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }

    if (char === '"') {
      insideQuotes = true;
      i++;
      continue;
    }

    if (char === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      i++;
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        i++;
      }
      currentRow.push(currentCell.trim());
      currentCell = "";
      rows.push(currentRow);
      currentRow = [];
      i++;
      continue;
    }

    currentCell += char;
    i++;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Parses multi-locale date strings (YYYY-MM-DD, DD/MM/YYYY, M/D/YYYY)
 * directly into UTC midnight ISO timestamps without local machine timezone drift.
 */
export function parseOutlookCsvDate(
  dateStr?: string | null,
): string | undefined {
  if (!dateStr) return undefined;
  const trimmed = dateStr.trim();
  if (!trimmed) return undefined;

  // Format 1: ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(trimmed);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}T00:00:00.000Z`;
  }

  // Format 2: Slash/dash delimited with year at the end (DD/MM/YYYY or M/D/YYYY)
  const slashMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(trimmed);
  if (slashMatch) {
    const p1 = slashMatch[1];
    const p2 = slashMatch[2];
    const y = slashMatch[3];
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);

    // Unambiguous European format: Day > 12 -> p1 is Day, p2 is Month
    if (n1 > 12) {
      const d = p1.padStart(2, "0");
      const m = p2.padStart(2, "0");
      return `${y}-${m}-${d}T00:00:00.000Z`;
    }

    // Unambiguous US format: Month > 12 -> p2 is Day, p1 is Month
    if (n2 > 12) {
      const m = p1.padStart(2, "0");
      const d = p2.padStart(2, "0");
      return `${y}-${m}-${d}T00:00:00.000Z`;
    }

    // Ambiguous dates: default to M/D/YYYY (or DD/MM/YYYY)
    const m = p1.padStart(2, "0");
    const d = p2.padStart(2, "0");
    return `${y}-${m}-${d}T00:00:00.000Z`;
  }

  return undefined;
}

/**
 * Normalizes raw task object into a clean MicrosoftTaskResource
 */
function normalizeTaskResource(
  raw: Record<string, unknown>,
): MicrosoftTaskResource {
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : crypto.randomUUID();

  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : "Untitled Task";

  let body: MicrosoftTaskResource["body"] = undefined;
  if (raw.body && typeof raw.body === "object") {
    const rawBody = raw.body as Record<string, unknown>;
    body = {
      content: typeof rawBody.content === "string" ? rawBody.content : "",
      contentType: rawBody.contentType === "html" ? "html" : "text",
    };
  }

  let importance: MicrosoftTaskResource["importance"] = "normal";
  if (raw.importance === "high") importance = "high";
  else if (raw.importance === "low") importance = "low";

  let status: MicrosoftTaskResource["status"] = "notStarted";
  if (
    raw.status === "completed" ||
    raw.status === "inProgress" ||
    raw.status === "waitingOnOthers" ||
    raw.status === "deferred"
  ) {
    status = raw.status;
  }

  const isReminderOn = Boolean(raw.isReminderOn);

  let dueDateTime: MicrosoftTaskResource["dueDateTime"] = undefined;
  if (raw.dueDateTime && typeof raw.dueDateTime === "object") {
    const rawDue = raw.dueDateTime as Record<string, unknown>;
    if (typeof rawDue.dateTime === "string") {
      dueDateTime = {
        dateTime: rawDue.dateTime,
        timeZone: typeof rawDue.timeZone === "string" ? rawDue.timeZone : "UTC",
      };
    }
  }

  let completedDateTime: MicrosoftTaskResource["completedDateTime"] = undefined;
  if (raw.completedDateTime && typeof raw.completedDateTime === "object") {
    const rawComp = raw.completedDateTime as Record<string, unknown>;
    if (typeof rawComp.dateTime === "string") {
      completedDateTime = {
        dateTime: rawComp.dateTime,
        timeZone:
          typeof rawComp.timeZone === "string" ? rawComp.timeZone : "UTC",
      };
    }
  }

  const checklistItems: MicrosoftChecklistItem[] = [];
  if (Array.isArray(raw.checklistItems)) {
    for (const item of raw.checklistItems) {
      if (item && typeof item === "object") {
        const itemObj = item as Record<string, unknown>;
        checklistItems.push({
          id:
            typeof itemObj.id === "string" && itemObj.id.trim()
              ? itemObj.id.trim()
              : crypto.randomUUID(),
          displayName:
            typeof itemObj.displayName === "string"
              ? itemObj.displayName
              : "Untitled Step",
          isChecked: Boolean(itemObj.isChecked),
          createdDateTime:
            typeof itemObj.createdDateTime === "string"
              ? itemObj.createdDateTime
              : undefined,
          checkedDateTime:
            typeof itemObj.checkedDateTime === "string"
              ? itemObj.checkedDateTime
              : null,
        });
      }
    }
  }

  return {
    id,
    title,
    body,
    importance,
    status,
    isReminderOn,
    createdDateTime:
      typeof raw.createdDateTime === "string" ? raw.createdDateTime : undefined,
    lastModifiedDateTime:
      typeof raw.lastModifiedDateTime === "string"
        ? raw.lastModifiedDateTime
        : undefined,
    dueDateTime,
    completedDateTime,
    checklistItems,
  };
}

/**
 * Parses Microsoft Tasks Graph JSON file contents safely into a normalized MicrosoftTasksDataset.
 * Supports `{ lists: [...] }`, `{ value: [...] }`, and raw arrays.
 */
export function parseMicrosoftTasksJson(
  jsonContent: string,
): MicrosoftTasksDataset {
  let cleanContent = jsonContent;
  // Strip UTF-8 BOM if present
  if (cleanContent.charCodeAt(0) === 0xfeff) {
    cleanContent = cleanContent.slice(1);
  }

  const trimmed = cleanContent.trim();
  if (!trimmed) {
    throw new Error("Invalid Microsoft Tasks file: Content is empty");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid JSON: Could not parse Microsoft Tasks file");
  }

  if (!parsed || (typeof parsed !== "object" && !Array.isArray(parsed))) {
    throw new Error(
      "Invalid Microsoft Tasks format: Expected JSON object or array",
    );
  }

  const lists: MicrosoftTaskListResource[] = [];
  const tasksByListId: Record<string, MicrosoftTaskResource[]> = {};

  // Case A: Raw JSON Array
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      // Empty array -> return default empty list
      const defaultList: MicrosoftTaskListResource = {
        id: "default-list",
        displayName: "Tasks",
        wellknownListName: "defaultList",
        isOwner: true,
        isShared: false,
        tasks: [],
      };
      return { lists: [defaultList], tasksByListId: { "default-list": [] } };
    }

    const firstItem = parsed[0];
    const isListOfLists =
      firstItem &&
      typeof firstItem === "object" &&
      ("displayName" in firstItem || "wellknownListName" in firstItem);

    if (isListOfLists) {
      for (const rawList of parsed) {
        if (!rawList || typeof rawList !== "object") continue;
        const listObj = rawList as Record<string, unknown>;
        const listId =
          typeof listObj.id === "string" && listObj.id.trim()
            ? listObj.id.trim()
            : crypto.randomUUID();
        const displayName =
          typeof listObj.displayName === "string" && listObj.displayName.trim()
            ? listObj.displayName.trim()
            : "Tasks";
        const wellknownListName =
          listObj.wellknownListName === "defaultList" ||
          listObj.wellknownListName === "flaggedEmails" ||
          listObj.wellknownListName === "unknown"
            ? listObj.wellknownListName
            : "none";

        const rawTasks = Array.isArray(listObj.tasks) ? listObj.tasks : [];
        const tasks: MicrosoftTaskResource[] = rawTasks.map((t) =>
          normalizeTaskResource(t as Record<string, unknown>),
        );

        lists.push({
          id: listId,
          displayName,
          isOwner: listObj.isOwner !== false,
          isShared: Boolean(listObj.isShared),
          wellknownListName,
          tasks,
        });
        tasksByListId[listId] = tasks;
      }
      return { lists, tasksByListId };
    } else {
      // Array of tasks
      const defaultListId = "default-list";
      const tasks: MicrosoftTaskResource[] = parsed.map((t) =>
        normalizeTaskResource(t as Record<string, unknown>),
      );
      lists.push({
        id: defaultListId,
        displayName: "Tasks",
        isOwner: true,
        isShared: false,
        wellknownListName: "defaultList",
        tasks,
      });
      tasksByListId[defaultListId] = tasks;
      return { lists, tasksByListId };
    }
  }

  // Case B: JSON Object
  const rootObj = parsed as Record<string, unknown>;

  // B.1: { lists: [...] }
  if (Array.isArray(rootObj.lists)) {
    const rawTasksByListId =
      rootObj.tasksByListId && typeof rootObj.tasksByListId === "object"
        ? (rootObj.tasksByListId as Record<string, unknown[]>)
        : {};

    for (const rawList of rootObj.lists) {
      if (!rawList || typeof rawList !== "object") continue;
      const listObj = rawList as Record<string, unknown>;
      const listId =
        typeof listObj.id === "string" && listObj.id.trim()
          ? listObj.id.trim()
          : crypto.randomUUID();
      const displayName =
        typeof listObj.displayName === "string" && listObj.displayName.trim()
          ? listObj.displayName.trim()
          : "Tasks";
      const wellknownListName =
        listObj.wellknownListName === "defaultList" ||
        listObj.wellknownListName === "flaggedEmails" ||
        listObj.wellknownListName === "unknown"
          ? listObj.wellknownListName
          : "none";

      const listDirectTasks = Array.isArray(listObj.tasks) ? listObj.tasks : [];
      const separateTasks = Array.isArray(rawTasksByListId[listId])
        ? rawTasksByListId[listId]
        : [];

      const rawTasks =
        listDirectTasks.length > 0 ? listDirectTasks : separateTasks;
      const tasks: MicrosoftTaskResource[] = rawTasks.map((t) =>
        normalizeTaskResource(t as Record<string, unknown>),
      );

      lists.push({
        id: listId,
        displayName,
        isOwner: listObj.isOwner !== false,
        isShared: Boolean(listObj.isShared),
        wellknownListName,
        tasks,
      });
      tasksByListId[listId] = tasks;
    }

    return { lists, tasksByListId };
  }

  // B.2: Graph API { value: [...] } envelope
  if (Array.isArray(rootObj.value)) {
    const valueArray = rootObj.value;
    if (valueArray.length === 0) {
      const defaultList: MicrosoftTaskListResource = {
        id: "default-list",
        displayName: "Tasks",
        wellknownListName: "defaultList",
        isOwner: true,
        isShared: false,
        tasks: [],
      };
      return { lists: [defaultList], tasksByListId: { "default-list": [] } };
    }

    const firstItem = valueArray[0];
    const isListOfLists =
      firstItem &&
      typeof firstItem === "object" &&
      ("displayName" in firstItem || "wellknownListName" in firstItem);

    if (isListOfLists) {
      for (const rawList of valueArray) {
        if (!rawList || typeof rawList !== "object") continue;
        const listObj = rawList as Record<string, unknown>;
        const listId =
          typeof listObj.id === "string" && listObj.id.trim()
            ? listObj.id.trim()
            : crypto.randomUUID();
        const displayName =
          typeof listObj.displayName === "string" && listObj.displayName.trim()
            ? listObj.displayName.trim()
            : "Tasks";
        const wellknownListName =
          listObj.wellknownListName === "defaultList" ||
          listObj.wellknownListName === "flaggedEmails" ||
          listObj.wellknownListName === "unknown"
            ? listObj.wellknownListName
            : "none";

        const rawTasks = Array.isArray(listObj.tasks) ? listObj.tasks : [];
        const tasks: MicrosoftTaskResource[] = rawTasks.map((t) =>
          normalizeTaskResource(t as Record<string, unknown>),
        );

        lists.push({
          id: listId,
          displayName,
          isOwner: listObj.isOwner !== false,
          isShared: Boolean(listObj.isShared),
          wellknownListName,
          tasks,
        });
        tasksByListId[listId] = tasks;
      }
      return { lists, tasksByListId };
    } else {
      // Array of tasks
      const defaultListId = "default-list";
      const tasks: MicrosoftTaskResource[] = valueArray.map((t) =>
        normalizeTaskResource(t as Record<string, unknown>),
      );
      lists.push({
        id: defaultListId,
        displayName: "Tasks",
        isOwner: true,
        isShared: false,
        wellknownListName: "defaultList",
        tasks,
      });
      tasksByListId[defaultListId] = tasks;
      return { lists, tasksByListId };
    }
  }

  throw new Error(
    "Invalid Microsoft Tasks format: Expected lists or value property",
  );
}

/**
 * Parses Classic Outlook Tasks CSV exports with multi-format dates and category grouping.
 */
export function parseOutlookTasksCsv(
  csvContent: string,
): MicrosoftTasksDataset {
  let clean = csvContent;
  if (clean.charCodeAt(0) === 0xfeff) {
    clean = clean.slice(1);
  }

  const trimmed = clean.trim();
  if (!trimmed) {
    throw new Error("Invalid Outlook CSV: Content is empty");
  }

  const rows = tokenizeCsv(trimmed);
  if (rows.length <= 1) {
    throw new Error("Invalid Outlook CSV: No tasks found in CSV");
  }

  const headers = rows[0].map((h) => h.toLowerCase().trim());

  // Locate column headers
  const subjectIdx = headers.findIndex((h) =>
    ["subject", "title", "task"].includes(h),
  );
  const dueDateIdx = headers.findIndex((h) =>
    ["due date", "due", "duedate"].includes(h),
  );
  const statusIdx = headers.findIndex((h) =>
    ["status", "complete", "% complete", "percent complete"].includes(h),
  );
  const priorityIdx = headers.findIndex((h) =>
    ["priority", "importance"].includes(h),
  );
  const categoriesIdx = headers.findIndex((h) =>
    ["categories", "category"].includes(h),
  );
  const bodyIdx = headers.findIndex((h) =>
    ["body", "description", "notes"].includes(h),
  );
  const dateCompletedIdx = headers.findIndex((h) =>
    ["date completed", "completed date", "datecompleted"].includes(h),
  );

  const dataRows = rows
    .slice(1)
    .filter((r) => r.some((cell) => cell.length > 0));
  if (dataRows.length === 0) {
    throw new Error("Invalid Outlook CSV: No tasks found in CSV");
  }

  const defaultListId = "default-list";
  const defaultList: MicrosoftTaskListResource = {
    id: defaultListId,
    displayName: "Tasks",
    wellknownListName: "defaultList",
    isOwner: true,
    isShared: false,
    tasks: [],
  };

  const listsByDisplayName = new Map<string, MicrosoftTaskListResource>();
  const tasksByListId: Record<string, MicrosoftTaskResource[]> = {
    [defaultListId]: [],
  };

  for (const row of dataRows) {
    const rawSubject = subjectIdx >= 0 ? row[subjectIdx] : "";
    const subject = rawSubject?.trim() || "Untitled Task";

    const rawCategory = categoriesIdx >= 0 ? row[categoriesIdx] : "";
    let categoryName = "";
    if (rawCategory && rawCategory.trim()) {
      // Handle multiple categories: take the first one
      categoryName = rawCategory.split(/[;,]/)[0].trim();
    }

    let targetListId = defaultListId;
    if (categoryName) {
      let catList = listsByDisplayName.get(categoryName.toLowerCase());
      if (!catList) {
        const catListId = `cat-${crypto.randomUUID()}`;
        catList = {
          id: catListId,
          displayName: categoryName,
          wellknownListName: "none",
          isOwner: true,
          isShared: false,
          tasks: [],
        };
        listsByDisplayName.set(categoryName.toLowerCase(), catList);
        tasksByListId[catListId] = [];
      }
      targetListId = catList.id;
    }

    // Parse priority
    const rawPriority = priorityIdx >= 0 ? row[priorityIdx]?.toLowerCase() : "";
    let importance: MicrosoftTaskResource["importance"] = "normal";
    if (rawPriority) {
      if (rawPriority.includes("high") || rawPriority === "1") {
        importance = "high";
      } else if (rawPriority.includes("low") || rawPriority === "3") {
        importance = "low";
      }
    }

    // Parse status
    const rawStatus = statusIdx >= 0 ? row[statusIdx]?.toLowerCase() : "";
    let status: MicrosoftTaskResource["status"] = "notStarted";
    if (rawStatus) {
      if (
        rawStatus.includes("complete") ||
        rawStatus === "true" ||
        rawStatus === "100%" ||
        rawStatus === "100"
      ) {
        status = "completed";
      } else if (rawStatus.includes("in progress")) {
        status = "inProgress";
      } else if (rawStatus.includes("waiting")) {
        status = "waitingOnOthers";
      } else if (rawStatus.includes("deferred")) {
        status = "deferred";
      }
    }

    // Parse dates
    const rawDueDate = dueDateIdx >= 0 ? row[dueDateIdx] : undefined;
    const dueDateIso = parseOutlookCsvDate(rawDueDate);
    const dueDateTime = dueDateIso
      ? { dateTime: dueDateIso, timeZone: "UTC" }
      : undefined;

    const rawCompletedDate =
      dateCompletedIdx >= 0 ? row[dateCompletedIdx] : undefined;
    const completedDateIso = parseOutlookCsvDate(rawCompletedDate);
    const completedDateTime = completedDateIso
      ? { dateTime: completedDateIso, timeZone: "UTC" }
      : undefined;

    // Parse body
    const rawBody = bodyIdx >= 0 ? row[bodyIdx] : "";
    const body = rawBody?.trim()
      ? { content: rawBody.trim(), contentType: "text" as const }
      : undefined;

    const task: MicrosoftTaskResource = {
      id: crypto.randomUUID(),
      title: subject,
      body,
      importance,
      status,
      isReminderOn: false,
      dueDateTime,
      completedDateTime,
      checklistItems: [],
    };

    tasksByListId[targetListId].push(task);
  }

  const resultLists: MicrosoftTaskListResource[] = [];

  // Add default list if it contains tasks or if no category lists exist
  if (
    tasksByListId[defaultListId].length > 0 ||
    listsByDisplayName.size === 0
  ) {
    defaultList.tasks = tasksByListId[defaultListId];
    resultLists.push(defaultList);
  }

  // Add categorized lists
  for (const catList of listsByDisplayName.values()) {
    catList.tasks = tasksByListId[catList.id];
    resultLists.push(catList);
  }

  return {
    lists: resultLists,
    tasksByListId,
  };
}
