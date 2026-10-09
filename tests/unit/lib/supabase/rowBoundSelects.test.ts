import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";

const ROOT = path.resolve(__dirname, "../../../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

// A `-v2` value only opens with its row id, so a select of an encrypted column must fetch `id`.
function selectsMissingRowId(source: string): string[] {
  const found: string[] = [];
  for (const [, table, columnList] of source.matchAll(
    /from\(\s*"(\w+)"\s*\)\s*\.select\(\s*["`]([^"`]*)["`]/g,
  )) {
    const encrypted = FIELD_MAP[table];
    if (!encrypted) continue;
    const columns = columnList
      .split(",")
      .map((column) => column.trim().split(/[:(\s]/)[0]);
    if (columns.includes("*") || columns.includes("id")) continue;
    if (columns.some((column) => encrypted.includes(column))) {
      found.push(`${table}: ${columnList}`);
    }
  }
  return found;
}

describe("selects of encrypted columns fetch the row id", () => {
  it("flags a select that reads an encrypted column without id (sanity check on the parser)", () => {
    expect(
      selectsMissingRowId(`
        supabase.from("habits").select("name, sort_order");
        supabase.from("habits").select("id, name");
        supabase.from("habits").select("sort_order");
        supabase.from("tasks").select("*");
      `),
    ).toEqual(["habits: name, sort_order"]);
  });

  it("finds none in src/ or app/", () => {
    const offenders = ["src", "app"]
      .flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
      .flatMap((file) =>
        selectsMissingRowId(readFileSync(file, "utf-8")).map(
          (select) => `${path.relative(ROOT, file)} → ${select}`,
        ),
      );
    expect(offenders).toEqual([]);
  });
});
