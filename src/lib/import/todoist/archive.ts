import { unzipSync, strFromU8 } from "fflate";

export interface TodoistCsvFile {
  fileName: string;
  projectName: string;
  isInbox: boolean;
  csvContent: string;
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function stripCsvExtension(fileName: string): string {
  return fileName.replace(/\.csv$/i, "").trim();
}

function isImportableCsv(entryName: string): boolean {
  if (entryName.includes("__MACOSX/")) return false;
  const base = basename(entryName);
  if (!/\.csv$/i.test(base) || base.startsWith(".")) return false;
  return stripCsvExtension(base).length > 0;
}

export function extractTodoistCsvFiles(bytes: Uint8Array): TodoistCsvFile[] {
  if (bytes.length === 0) {
    throw new Error("Invalid Todoist backup: file is empty");
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error("Invalid Todoist backup: not a valid ZIP archive");
  }

  const csvEntries = Object.entries(entries)
    .filter(([name, data]) => isImportableCsv(name) && data.length > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  if (csvEntries.length === 0) {
    throw new Error("Invalid Todoist backup: no CSV files found");
  }

  return csvEntries.map(([name, data]) => {
    const fileName = basename(name);
    const rawName = stripCsvExtension(fileName);
    const isInbox = rawName.toLowerCase() === "inbox";
    return {
      fileName,
      projectName: isInbox ? "Inbox" : rawName,
      isInbox,
      csvContent: strFromU8(data),
    };
  });
}
