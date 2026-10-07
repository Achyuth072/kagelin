import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";

const schemaSql = readFileSync(
  path.resolve(__dirname, "../../../../supabase/schema.sql"),
  "utf-8",
);

function tablesWithUpdatePolicy(sql: string): Set<string> {
  return new Set(
    [
      ...sql.matchAll(
        /CREATE POLICY "[^"]+" ON (?:public\.)?(\w+)\s+FOR (?:UPDATE|ALL)\b/g,
      ),
    ].map(([, table]) => table),
  );
}

// The Re-seal rewrites every encrypted value in place; without an UPDATE policy the
// write matches no row and the upgrade can never finish.
describe("encrypted tables", () => {
  it("finds update policies (sanity check on the parser)", () => {
    expect(
      tablesWithUpdatePolicy(`
CREATE POLICY "a" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "b" ON public.labels FOR SELECT USING (true);
`),
    ).toEqual(new Set(["tasks"]));
  });

  it.each(Object.keys(FIELD_MAP))("%s lets its owner update rows", (table) => {
    expect(tablesWithUpdatePolicy(schemaSql)).toContain(table);
  });
});
