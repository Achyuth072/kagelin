import type { TodoistRow, TodoistRowType, ParseTodoistResult } from "./types";
function tokenizeCsv(text: string, delimiter: string): string[][] {
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

function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

export function parseTodoistCsv(csvContent: string): ParseTodoistResult {
  // Strip UTF-8 BOM if present
  let cleanContent = csvContent;
  if (cleanContent.charCodeAt(0) === 0xfeff) {
    cleanContent = cleanContent.slice(1);
  }

  if (!cleanContent.trim()) {
    throw new Error("Invalid Todoist CSV: File is empty");
  }

  const firstLine = cleanContent.split(/\r?\n/, 1)[0] ?? cleanContent;
  const delimiter = detectDelimiter(firstLine);
  const tokenizedRows = tokenizeCsv(cleanContent, delimiter);

  if (tokenizedRows.length === 0) {
    throw new Error("Invalid Todoist CSV: No rows found");
  }

  const headerRow = tokenizedRows[0].map((h) => h.toUpperCase());
  const typeIndex = headerRow.indexOf("TYPE");
  const contentIndex = headerRow.indexOf("CONTENT");

  if (typeIndex === -1 || contentIndex === -1) {
    throw new Error(
      "Invalid Todoist CSV format: Missing TYPE or CONTENT column headers",
    );
  }

  const descIndex = headerRow.indexOf("DESCRIPTION");
  const priorityIndex = headerRow.indexOf("PRIORITY");
  const indentIndex = headerRow.indexOf("INDENT");
  const authorIndex = headerRow.indexOf("AUTHOR");
  const responsibleIndex = headerRow.indexOf("RESPONSIBLE");
  const dateIndex = headerRow.indexOf("DATE");
  const dateLangIndex = headerRow.indexOf("DATE_LANG");
  const timezoneIndex = headerRow.indexOf("TIMEZONE");
  const durationIndex = headerRow.indexOf("DURATION");
  const durationUnitIndex = headerRow.indexOf("DURATION_UNIT");
  const deadlineIndex = headerRow.indexOf("DEADLINE");
  const deadlineLangIndex = headerRow.indexOf("DEADLINE_LANG");
  const isCollapsedIndex = headerRow.indexOf("IS_COLLAPSED");

  const validTypes = new Set<TodoistRowType>([
    "task",
    "section",
    "note",
    "meta",
  ]);
  const parsedRows: TodoistRow[] = [];
  const meta: ParseTodoistResult["meta"] = {};

  for (let r = 1; r < tokenizedRows.length; r++) {
    const row = tokenizedRows[r];
    if (row.length === 0 || row.every((cell) => cell === "")) {
      continue;
    }

    const rawType = (row[typeIndex] ?? "").toLowerCase() as TodoistRowType;
    if (!validTypes.has(rawType)) {
      continue;
    }

    const content = row[contentIndex] ?? "";
    const getCell = (idx: number) =>
      idx !== -1 && row[idx] ? row[idx] : undefined;

    const rawPriority =
      priorityIndex !== -1 ? parseInt(row[priorityIndex], 10) : NaN;
    const priority =
      rawPriority >= 1 && rawPriority <= 4
        ? (rawPriority as 1 | 2 | 3 | 4)
        : undefined;

    const rawIndent = indentIndex !== -1 ? parseInt(row[indentIndex], 10) : NaN;
    const indent = !isNaN(rawIndent) && rawIndent >= 1 ? rawIndent : 1;

    const rawDuration =
      durationIndex !== -1 ? parseFloat(row[durationIndex]) : NaN;
    const duration = !isNaN(rawDuration) ? rawDuration : undefined;

    const todoistRow: TodoistRow = {
      type: rawType,
      content,
      description: getCell(descIndex),
      priority,
      indent,
      author: getCell(authorIndex),
      responsible: getCell(responsibleIndex),
      date: getCell(dateIndex),
      dateLang: getCell(dateLangIndex),
      timezone: getCell(timezoneIndex),
      duration,
      durationUnit: getCell(durationUnitIndex),
      deadline: getCell(deadlineIndex),
      deadlineLang: getCell(deadlineLangIndex),
      isCollapsed:
        isCollapsedIndex !== -1
          ? row[isCollapsedIndex]?.toUpperCase() === "TRUE"
          : undefined,
    };

    if (rawType === "meta") {
      if (content.includes("view_style=board")) {
        meta.viewStyle = "board";
      } else if (content.includes("view_style=list")) {
        meta.viewStyle = "list";
      }
    }

    parsedRows.push(todoistRow);
  }

  return {
    rows: parsedRows,
    meta,
  };
}
