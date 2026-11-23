import {
  RawTickTickRowSchema,
  type RawTickTickRow,
  type ExtractedChecklistItem,
  TICKTICK_CSV_COLUMNS,
} from "./types";

export function tokenizeCsv(text: string, delimiter = ","): string[][] {
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

export function extractChecklistItems(content: string): {
  items: ExtractedChecklistItem[];
  strippedDescription: string | null;
} {
  if (!content || !content.trim()) {
    return { items: [], strippedDescription: null };
  }

  const lines = content.split(/\r?\n/);
  const items: ExtractedChecklistItem[] = [];
  const remainingLines: string[] = [];

  // TickTick exports checklists with Unicode white square (▫) bullets or standard markdown checkboxes
  const checklistPattern =
    /^(?:▫\s*\[([ xX])\]\s*|▫\s*|-+\s*\[([ xX])\]\s*)(.*)$/;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const match = checklistPattern.exec(trimmedLine);

    if (match) {
      const checkboxBox = match[1] ?? match[2];
      const isCompleted =
        typeof checkboxBox === "string" && checkboxBox.toLowerCase() === "x";
      const itemTitle = (match[3] || "").trim();

      if (itemTitle.length > 0) {
        items.push({
          title: itemTitle,
          is_completed: isCompleted,
        });
      }
    } else {
      remainingLines.push(line);
    }
  }

  const stripped = remainingLines.join("\n").trim();
  return {
    items,
    strippedDescription: stripped.length > 0 ? stripped : null,
  };
}

export function parseTickTickCsv(rawCsv: string): RawTickTickRow[] {
  if (!rawCsv || !rawCsv.trim()) {
    throw new Error("TickTick CSV content is empty");
  }

  const cleanCsv = rawCsv.charCodeAt(0) === 0xfeff ? rawCsv.slice(1) : rawCsv;

  const rows = tokenizeCsv(cleanCsv);

  const headerRowIndex = rows.findIndex(
    (row) => row.includes("Title") && row.includes("taskId"),
  );

  if (headerRowIndex === -1) {
    throw new Error(
      "Invalid TickTick CSV: missing header row containing 'Title' and 'taskId'",
    );
  }

  const headerRow = rows[headerRowIndex];
  const columnIndexMap = new Map<string, number>();

  headerRow.forEach((colName, index) => {
    if (colName) {
      columnIndexMap.set(colName.trim(), index);
    }
  });

  const parsedRows: RawTickTickRow[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];

    if (row.length === 0 || row.every((cell) => !cell || !cell.trim())) {
      continue;
    }

    const rowObj: Record<string, string> = {};
    for (const canonicalCol of TICKTICK_CSV_COLUMNS) {
      const idx = columnIndexMap.get(canonicalCol);
      if (idx !== undefined && idx < row.length) {
        rowObj[canonicalCol] = row[idx];
      } else {
        rowObj[canonicalCol] = "";
      }
    }

    if (!rowObj.taskId || !rowObj.taskId.trim()) {
      continue;
    }

    const validated = RawTickTickRowSchema.parse(rowObj);
    parsedRows.push(validated);
  }

  return parsedRows;
}
