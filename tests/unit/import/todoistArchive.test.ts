import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { extractTodoistCsvFiles } from "@/lib/import/todoist/archive";

function makeZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = Object.create(null);
  for (const [name, content] of Object.entries(files)) {
    entries[name] = strToU8(content);
  }
  return zipSync(entries);
}

const WORK_CSV = `TYPE,CONTENT,PRIORITY,INDENT
meta,view_style=board,,,
task,Ship release,1,1
`;

const INBOX_CSV = `TYPE,CONTENT,PRIORITY,INDENT
task,Reply to email,4,1
`;

describe("Todoist backup ZIP extractor", () => {
  it("extracts each CSV with its project name and flags the inbox", () => {
    const zip = makeZip({ "Work.csv": WORK_CSV, "Inbox.csv": INBOX_CSV });

    const files = extractTodoistCsvFiles(zip);

    expect(files).toHaveLength(2);
    const work = files.find((f) => f.fileName === "Work.csv");
    const inbox = files.find((f) => f.fileName === "Inbox.csv");

    expect(work).toMatchObject({
      projectName: "Work",
      isInbox: false,
      csvContent: WORK_CSV,
    });
    expect(inbox).toMatchObject({
      projectName: "Inbox",
      isInbox: true,
      csvContent: INBOX_CSV,
    });
  });

  it("ignores macOS metadata and non-CSV entries in the archive", () => {
    const zip = makeZip({
      "__MACOSX/._Work.csv": "junk",
      "Work.csv": WORK_CSV,
      "README.txt": "not a project",
    });

    const files = extractTodoistCsvFiles(zip);

    expect(files).toHaveLength(1);
    expect(files[0].fileName).toBe("Work.csv");
  });

  it("rejects a corrupted (non-ZIP) byte buffer with a descriptive error", () => {
    const corrupted = strToU8("this is definitely not a zip archive");

    expect(() => extractTodoistCsvFiles(corrupted)).toThrow(
      /not a valid ZIP archive/i,
    );
  });

  it("rejects an empty buffer", () => {
    expect(() => extractTodoistCsvFiles(new Uint8Array())).toThrow(/empty/i);
  });

  it("rejects an archive that contains no CSV files", () => {
    const zip = makeZip({ "notes.txt": "nothing to import" });

    expect(() => extractTodoistCsvFiles(zip)).toThrow(/no CSV files/i);
  });
});
