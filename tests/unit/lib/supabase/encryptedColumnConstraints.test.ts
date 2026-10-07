import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { encryptField } from "@/lib/crypto/contentCipher";

function findLengthCheckedColumns(sql: string): string[] {
  const found: string[] = [];
  const scopes = [
    /ALTER TABLE\s+(?:public\.)?(\w+)([\s\S]*?);/g,
    /CREATE TABLE IF NOT EXISTS (?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g,
  ];

  for (const scope of scopes) {
    for (const [, table, body] of sql.matchAll(scope)) {
      for (const [, column] of body.matchAll(/char_length\(\s*(\w+)/g)) {
        found.push(`${table}.${column}`);
      }
    }
  }
  return found;
}

const schemaSql = readFileSync(
  path.resolve(__dirname, "../../../../supabase/schema.sql"),
  "utf-8",
);

describe("encrypted columns carry no length constraint", () => {
  it("finds a length check in both statement forms (sanity check on the parser)", () => {
    expect(
      findLengthCheckedColumns(`
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_content_length_check CHECK (char_length(content) <= 500);

CREATE TABLE IF NOT EXISTS public.notes (
  body TEXT CHECK (char_length(body) <= 10)
);
`),
    ).toEqual(["tasks.content", "notes.body"]);
  });

  it("leaves no encrypted column length-checked in schema.sql", () => {
    const encrypted = new Set(
      Object.entries(FIELD_MAP).flatMap(([table, columns]) =>
        columns.map((column) => `${table}.${column}`),
      ),
    );

    expect(
      findLengthCheckedColumns(schemaSql).filter((column) =>
        encrypted.has(column),
      ),
    ).toEqual([]);
  });

  it("overflows the old 500-char ceiling well inside the app's own content limit", async () => {
    const key = new Uint8Array(32).fill(7);
    const envelope = await encryptField(key, "a".repeat(500));

    expect(envelope.length).toBeGreaterThan(500);
  });
});

describe("server-side scheme checks accept the row-bound -v2 envelope", () => {
  it("recognises -v1 and -v2 in every sealed-value check", () => {
    // encrypted_notification_body, the plaintext backstop, and the habit-notes trigger.
    const checks = schemaSql.match(/'\^?xchacha20poly1305-v\[12\]:'/g) ?? [];
    expect(checks).toHaveLength(3);
  });

  it("names -v1 alone only where the backstop rejects it after the Re-seal marker", () => {
    const v1Only = schemaSql.match(/'\^xchacha20poly1305-v1:'/g) ?? [];
    expect(v1Only).toHaveLength(2);

    const backstops = schemaSql.match(
      /CREATE OR REPLACE FUNCTION public\.reject_unmigrated_plaintext(?:_habit_entry)?\(\)[\s\S]*?\n\$\$;/g,
    );
    expect(backstops).toHaveLength(2);
    for (const fn of backstops!) {
      expect(fn).toMatch(/sealed_v2_at IS NOT NULL/);
      expect(fn).toMatch(/xchacha20poly1305-v1:/);
      expect(fn).toMatch(/HINT = 'sealing_scheme_outdated'/);
    }
  });

  it("stores the markers and key chain on the key row", () => {
    expect(schemaSql).toMatch(/current_key_id INTEGER NOT NULL DEFAULT 1/);
    expect(schemaSql).toMatch(/retired_keys JSONB NOT NULL DEFAULT/);
    expect(schemaSql).toMatch(/sealed_v2_at TIMESTAMPTZ/);
  });
});

describe("server-side backstop for a rotated content key", () => {
  const backstops = schemaSql.match(
    /CREATE OR REPLACE FUNCTION public\.reject_unmigrated_plaintext(?:_habit_entry)?\(\)[\s\S]*?\n\$\$;/g,
  );

  it("rejects an envelope whose key id is not the current one, in both triggers", () => {
    expect(backstops).toHaveLength(2);
    for (const fn of backstops!) {
      expect(fn).toMatch(/current_key_id::text/);
      expect(fn).toMatch(/split_part\([^)]*':', 2\) <> current_key/);
      expect(fn).toMatch(/HINT = 'content_key_retired'/);
    }
  });

  it("commits a rotation through one RPC that bumps current_key_id only from the expected id", () => {
    const rpc = schemaSql.match(
      /CREATE OR REPLACE FUNCTION public\.rotate_content_key\([\s\S]*?\n\$\$;/,
    )?.[0];
    expect(rpc).toBeDefined();
    expect(rpc).toMatch(/current_key_id = current_key_id \+ 1/);
    expect(rpc).toMatch(/current_key_id = p_expected_key_id/);
    expect(rpc).toMatch(/sealed_v2_at = NULL/);
    expect(rpc).toMatch(/retired_keys = p_retired_keys/);
  });
});
