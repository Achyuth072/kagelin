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
    // Checks: encrypted_notification_body, plaintext backstop, habit notes trigger, task and event reminder triggers.
    const checks = schemaSql.match(/'\^?xchacha20poly1305-v\[12\]:'/g) ?? [];
    expect(checks).toHaveLength(5);
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
    expect(rpc).toMatch(/retired_keys = p_retired_keys/);
    expect(rpc).toMatch(/SECURITY DEFINER/);
  });

  it("rotates only for a caller that proves it holds the current key, in schema and migration", () => {
    const migration = readFileSync(
      path.resolve(
        __dirname,
        "../../../../supabase/migrations/20261008120500_rotation_requires_key_proof.sql",
      ),
      "utf-8",
    );
    for (const sql of [schemaSql, migration]) {
      const rpc = sql.match(
        /CREATE OR REPLACE FUNCTION public\.rotate_content_key\([\s\S]*?\n\$\$;/,
      )?.[0];
      expect(rpc).toContain(
        "stored_verifier IS DISTINCT FROM encode(sha256(decode(p_rotation_token, 'base64')), 'base64')",
      );
      expect(rpc).toContain("rotation_verifier = p_rotation_verifier");
    }
    expect(migration).toContain(
      "DROP FUNCTION IF EXISTS public.rotate_content_key(INTEGER, TEXT, JSONB, TEXT, TEXT, JSONB, TEXT, JSONB);",
    );
  });

  it("keeps the -v1 rejection on through a rotation", () => {
    const rpc = schemaSql.match(
      /CREATE OR REPLACE FUNCTION public\.rotate_content_key\([\s\S]*?\n\$\$;/,
    )?.[0];
    expect(rpc).not.toMatch(/sealed_v2_at/);
  });
});

describe("the key row's markers cannot be rolled back by a direct UPDATE", () => {
  const guard = schemaSql.match(
    /CREATE OR REPLACE FUNCTION public\.guard_encryption_key_markers\(\)[\s\S]*?\n\$\$;/,
  )?.[0];

  it("runs before every update of encryption_keys", () => {
    expect(schemaSql).toMatch(
      /CREATE TRIGGER encryption_keys_guard_markers\s+BEFORE UPDATE ON public\.encryption_keys\s+FOR EACH ROW EXECUTE FUNCTION public\.guard_encryption_key_markers\(\)/,
    );
  });

  it("lets a device set the rotation verifier once, and only a rotation replace it", () => {
    expect(guard).toContain(
      "OLD.rotation_verifier IS NOT NULL AND NEW.rotation_verifier IS DISTINCT FROM OLD.rotation_verifier",
    );
  });

  it("lets only the rotation RPC move the key chain, and never clears a marker", () => {
    expect(guard).toBeDefined();
    expect(guard).toMatch(/current_user IN \('authenticated', 'anon'\)/);
    expect(guard).toMatch(
      /NEW\.current_key_id IS DISTINCT FROM OLD\.current_key_id/,
    );
    expect(guard).toMatch(/NEW\.retired_keys <> '\{\}'::jsonb/);
    expect(guard).toMatch(
      /OLD\.migrated_at IS NOT NULL AND NEW\.migrated_at IS NULL/,
    );
    expect(guard).toMatch(
      /OLD\.sealed_v2_at IS NOT NULL AND NEW\.sealed_v2_at IS NULL/,
    );
  });
});

describe("a Re-seal write keeps updated_at", () => {
  it("in the schema and its migration, keyed on the header the Re-seal sends", () => {
    const migration = readFileSync(
      path.resolve(
        __dirname,
        "../../../../supabase/migrations/20261008120600_reseal_keeps_updated_at.sql",
      ),
      "utf-8",
    );
    for (const sql of [schemaSql, migration]) {
      expect(sql).toContain(
        "IF NULLIF(current_setting('request.headers', true), '')::json->>'x-kagelin-reseal' = '1' THEN\n    NEW.updated_at = OLD.updated_at;",
      );
    }
  });
});
