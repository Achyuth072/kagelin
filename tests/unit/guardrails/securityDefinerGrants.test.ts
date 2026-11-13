import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Ensures SECURITY DEFINER functions revoke execute from anon and authenticated,
 * not just PUBLIC: Supabase's default privileges leave those explicit grants
 * intact, exposing the function over /rest/v1/rpc/* (advisors 0028/0029).
 */
export function findVulnerableSecurityDefinerFunctions(sqlContent: string): {
  functionName: string;
  issue: string;
}[] {
  const violations: { functionName: string; issue: string }[] = [];

  // e.g. CREATE OR REPLACE FUNCTION [public.]name(...) ... AS $$ ... $$ ...;
  const functionRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_.]+)\s*\(([^)]*)\)[\s\S]*?(?=\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b|\bCREATE\s+TABLE\b|\bALTER\s+TABLE\b|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = functionRegex.exec(sqlContent)) !== null) {
    const fnBlock = match[0];
    const fnName = match[1];

    const isSecurityDefiner = /\bSECURITY\s+DEFINER\b/i.test(fnBlock);
    if (!isSecurityDefiner) {
      continue;
    }

    const revokePublicOnly =
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+[^;]+FROM\s+PUBLIC\s*;/i.test(
        fnBlock,
      );
    const revokesAnon =
      /REVOKE\s+(?:EXECUTE\s+ON\s+FUNCTION|ALL\s+ON\s+FUNCTION)\s+[^;]+FROM\s+[^;]*\banon\b/i.test(
        fnBlock,
      );

    if (revokePublicOnly && !revokesAnon) {
      violations.push({
        functionName: fnName,
        issue:
          "Revoked only from PUBLIC. Must explicitly revoke from 'anon' (e.g. 'FROM PUBLIC, anon, authenticated') to clear Supabase default privileges.",
      });
    } else if (!revokesAnon) {
      const grantsAnon =
        /GRANT\s+(?:EXECUTE|ALL)\s+ON\s+FUNCTION\s+[^;]+TO\s+[^;]*\banon\b/i.test(
          fnBlock,
        );
      if (grantsAnon) {
        violations.push({
          functionName: fnName,
          issue:
            "Explicitly grants execute to anon on a SECURITY DEFINER function.",
        });
      }
    }
  }

  return violations;
}

/** Collects every RPC name passed to `.rpc("...")` in the given directories. */
export function findClientRpcCalls(dirs: string[]): string[] {
  const rpcs = new Set<string>();
  const regex = /\.rpc\s*(?:<[^>]+>)?\s*\(\s*["`]([a-zA-Z0-9_]+)["`]/g;

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        !/\.(test|spec)\.ts$/.test(entry.name)
      ) {
        const content = fs.readFileSync(full, "utf8");
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          rpcs.add(match[1]);
        }
      }
    }
  }

  for (const d of dirs) {
    walk(d);
  }

  return Array.from(rpcs).sort();
}

describe("Security Definer Privilege Guardrails (Supabase Advisor 0028/0029)", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const schemaPath = path.join(rootDir, "supabase/schema.sql");

  it("verifies supabase/schema.sql contains no SECURITY DEFINER functions vulnerable to PUBLIC-only revokes", () => {
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    const violations = findVulnerableSecurityDefinerFunctions(schemaSql);

    expect(
      violations,
      `Found SECURITY DEFINER functions without explicit anon revoke:\n${violations
        .map((v) => ` - ${v.functionName}: ${v.issue}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("flags vulnerable SQL snippets that only revoke FROM PUBLIC", () => {
    const vulnerableSnippet = `
CREATE OR REPLACE FUNCTION public.leaky_admin_func()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.profiles;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leaky_admin_func() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaky_admin_func() TO service_role;
`;

    const violations =
      findVulnerableSecurityDefinerFunctions(vulnerableSnippet);
    expect(violations.length).toBe(1);
    expect(violations[0].functionName).toBe("public.leaky_admin_func");
    expect(violations[0].issue).toContain("Revoked only from PUBLIC");
  });

  it("passes safe SQL snippets that revoke from PUBLIC, anon, authenticated", () => {
    const safeSnippet = `
CREATE OR REPLACE FUNCTION public.safe_admin_func()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.profiles;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.safe_admin_func() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.safe_admin_func() TO service_role;
`;

    const violations = findVulnerableSecurityDefinerFunctions(safeSnippet);
    expect(violations).toEqual([]);
  });

  it("passes SECURITY INVOKER functions without requiring anon revokes", () => {
    const invokerSnippet = `
CREATE OR REPLACE FUNCTION public.user_helper()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_helper() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_helper() TO authenticated;
`;

    const violations = findVulnerableSecurityDefinerFunctions(invokerSnippet);
    expect(violations).toEqual([]);
  });

  it("verifies all client-called RPCs in src/ and app/ have explicit GRANT EXECUTE ... TO authenticated in schema.sql", () => {
    const srcDir = path.join(rootDir, "src");
    const appDir = path.join(rootDir, "app");
    const clientRpcs = findClientRpcCalls([srcDir, appDir]);

    const schemaSql = fs.readFileSync(schemaPath, "utf8");

    const missingGrants: string[] = [];
    for (const rpc of clientRpcs) {
      const grantRegex = new RegExp(
        `GRANT\\s+(?:EXECUTE|ALL)\\s+ON\\s+FUNCTION\\s+(?:public\\.)?${rpc}\\b[^;]*TO\\s+[^;]*\\bauthenticated\\b`,
        "i",
      );
      if (!grantRegex.test(schemaSql)) {
        missingGrants.push(rpc);
      }
    }

    expect(
      missingGrants,
      `The following RPCs are called by frontend code (src/ or app/) but are missing explicit "GRANT EXECUTE ... TO authenticated" in supabase/schema.sql:\n${missingGrants
        .map(
          (r) =>
            ` - ${r}: add GRANT EXECUTE ON FUNCTION public.${r}(...) TO authenticated;`,
        )
        .join("\n")}`,
    ).toEqual([]);
  });
});
