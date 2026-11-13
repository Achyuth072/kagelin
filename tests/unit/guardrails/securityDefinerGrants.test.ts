import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

type Violation = {
  functionName: string;
  issue: string;
};

type ParsedFunction = {
  name: string;
  statement: string;
  body: string;
  securityDefiner: boolean;
  returnsTrigger: boolean;
};

type AclStatement = {
  kind: "GRANT" | "REVOKE";
  functionName: string;
  roles: string[];
};

const FIX_MIGRATION =
  "20261113053500_revoke_security_definer_anon_authenticated.sql";

function normalizeFunctionName(name: string): string {
  return name.replace(/^public\./i, "");
}

/** Removes function bodies so GRANT/REVOKE-looking text inside them is ignored. */
function stripFunctionBodies(sqlContent: string): string {
  return sqlContent.replace(/\$([a-zA-Z0-9_]*)\$[\s\S]*?\$\1\$/g, "$$ $$");
}

function extractFunctions(sqlContent: string): ParsedFunction[] {
  const functions: ParsedFunction[] = [];
  const functionStart =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_.]+)\s*\(/gi;

  let match: RegExpExecArray | null;
  while ((match = functionStart.exec(sqlContent)) !== null) {
    const name = normalizeFunctionName(match[1]);
    const start = match.index;
    const rest = sqlContent.slice(start);
    const bodyOpen = /AS\s+(\$[a-zA-Z0-9_]*\$)/i.exec(rest);
    let end = sqlContent.indexOf(";", start + match[0].length);
    let body = "";

    if (bodyOpen) {
      const tag = bodyOpen[1];
      const tagStart = start + bodyOpen.index + bodyOpen[0].length - tag.length;
      const bodyEnd = sqlContent.indexOf(tag, tagStart + tag.length);
      if (bodyEnd !== -1) {
        body = sqlContent.slice(tagStart + tag.length, bodyEnd);
        end = sqlContent.indexOf(";", bodyEnd + tag.length);
      }
    }

    if (end === -1) {
      end = sqlContent.length - 1;
    }

    const statement = sqlContent.slice(start, end + 1);
    functions.push({
      name,
      statement,
      body,
      securityDefiner: /\bSECURITY\s+DEFINER\b/i.test(statement),
      returnsTrigger: /\bRETURNS\s+TRIGGER\b/i.test(statement),
    });

    functionStart.lastIndex = end + 1;
  }

  return functions;
}

function extractAclStatements(sqlContent: string): AclStatement[] {
  const statements: AclStatement[] = [];
  const aclRegex = /^[ \t]*(GRANT|REVOKE)\b[\s\S]*?;/gim;
  const stripped = stripFunctionBodies(sqlContent);

  let match: RegExpExecArray | null;
  while ((match = aclRegex.exec(stripped)) !== null) {
    const statement = match[0];
    const functionMatch = /\bON\s+FUNCTION\s+([a-zA-Z0-9_.]+)\s*\(/i.exec(
      statement,
    );
    const roleMatch = /\b(?:FROM|TO)\s+([\s\S]+?)\s*;?\s*$/i.exec(statement);
    if (!functionMatch || !roleMatch) {
      continue;
    }

    const roles = roleMatch[1]
      .split(",")
      .map((role) =>
        role
          .trim()
          .replace(/\bGROUP\s+/i, "")
          .replace(/\s+WITH\s+GRANT\s+OPTION$/i, "")
          .toUpperCase(),
      )
      .filter(Boolean);

    statements.push({
      kind: match[1].toUpperCase() as "GRANT" | "REVOKE",
      functionName: normalizeFunctionName(functionMatch[1]),
      roles,
    });
  }

  return statements;
}

function findVulnerableSecurityDefinerFunctions(
  sqlContent: string,
): Violation[] {
  const violations: Violation[] = [];
  const aclStatements = extractAclStatements(sqlContent);

  for (const fn of extractFunctions(sqlContent)) {
    if (!fn.securityDefiner) {
      continue;
    }

    const fnAcls = aclStatements.filter((acl) => acl.functionName === fn.name);
    const revoked = new Set(
      fnAcls.filter((acl) => acl.kind === "REVOKE").flatMap((acl) => acl.roles),
    );
    const granted = new Set(
      fnAcls.filter((acl) => acl.kind === "GRANT").flatMap((acl) => acl.roles),
    );

    if (granted.has("ANON")) {
      violations.push({
        functionName: fn.name,
        issue:
          "Explicitly grants execute to anon on a SECURITY DEFINER function.",
      });
      continue;
    }

    if (granted.has("PUBLIC")) {
      violations.push({
        functionName: fn.name,
        issue:
          "Explicitly grants execute to PUBLIC on a SECURITY DEFINER function.",
      });
      continue;
    }

    const missing = [
      !revoked.has("PUBLIC") ? "PUBLIC" : null,
      !revoked.has("ANON") ? "anon" : null,
      !revoked.has("AUTHENTICATED") && !granted.has("AUTHENTICATED")
        ? "authenticated (revoke it or grant it explicitly)"
        : null,
    ].filter((role): role is string => role !== null);

    if (missing.length > 0) {
      violations.push({
        functionName: fn.name,
        issue: `Missing explicit revoke for ${missing.join(", ")}. SECURITY DEFINER functions must not rely on prior or default grants.`,
      });
    }
  }

  return violations;
}

/** Collects every RPC name passed to `.rpc("...")` in the given directories. */
function findClientRpcCalls(dirs: string[]): string[] {
  const rpcs = new Set<string>();
  const regex = /\.rpc\s*(?:<[^>]+>)?\s*\(\s*["`]([a-zA-Z0-9_]+)["`]/g;

  function walk(dir: string) {
    if (!fs.existsSync(dir)) {
      throw new Error(`RPC scan directory does not exist: ${dir}`);
    }
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

  it("verifies supabase/schema.sql contains no SECURITY DEFINER functions with incomplete revokes", () => {
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    const definerCount = extractFunctions(schemaSql).filter(
      (fn) => fn.securityDefiner,
    ).length;
    expect(definerCount).toBeGreaterThanOrEqual(10);

    const violations = findVulnerableSecurityDefinerFunctions(schemaSql);

    expect(
      violations,
      `Found SECURITY DEFINER functions without explicit PUBLIC/anon revokes:\n${violations
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
    expect(violations[0].functionName).toBe("leaky_admin_func");
    expect(violations[0].issue).toContain("anon");
  });

  it("flags revokes that omit anon even when they include authenticated", () => {
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

REVOKE EXECUTE ON FUNCTION public.leaky_admin_func() FROM PUBLIC, authenticated;
`;

    const violations =
      findVulnerableSecurityDefinerFunctions(vulnerableSnippet);
    expect(violations.length).toBe(1);
    expect(violations[0].functionName).toBe("leaky_admin_func");
    expect(violations[0].issue).toContain("anon");
  });

  it("flags a revoke that later grants execute back to anon", () => {
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

REVOKE EXECUTE ON FUNCTION public.leaky_admin_func() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaky_admin_func() TO anon;
`;

    const violations =
      findVulnerableSecurityDefinerFunctions(vulnerableSnippet);
    expect(violations.length).toBe(1);
    expect(violations[0].functionName).toBe("leaky_admin_func");
    expect(violations[0].issue).toContain("grants execute to anon");
  });

  it("flags SECURITY DEFINER functions that rely entirely on default grants", () => {
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
`;

    const violations =
      findVulnerableSecurityDefinerFunctions(vulnerableSnippet);
    expect(violations.length).toBe(1);
    expect(violations[0].issue).toContain("PUBLIC");
    expect(violations[0].issue).toContain("anon");
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

  it("passes split revokes and client RPCs that grant authenticated explicitly", () => {
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

REVOKE EXECUTE ON FUNCTION public.safe_admin_func() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.safe_admin_func() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.safe_client_func()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.profiles;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.safe_client_func() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.safe_client_func() TO authenticated;
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

  it("grants execute to authenticated for helpers called by SECURITY INVOKER triggers and RPCs", () => {
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    const functions = extractFunctions(schemaSql);
    const knownFunctions = new Set(functions.map((fn) => fn.name));
    const aclStatements = extractAclStatements(schemaSql);
    const grantedAuthenticated = new Set(
      aclStatements
        .filter(
          (acl) => acl.kind === "GRANT" && acl.roles.includes("AUTHENTICATED"),
        )
        .map((acl) => acl.functionName),
    );
    const clientRpcs = new Set(
      findClientRpcCalls([
        path.join(rootDir, "src"),
        path.join(rootDir, "app"),
      ]),
    );
    const missingGrants: string[] = [];
    const observedCallees = new Set<string>();

    for (const fn of functions) {
      if (
        fn.securityDefiner ||
        (!fn.returnsTrigger && !clientRpcs.has(fn.name))
      ) {
        continue;
      }

      const body = fn.body
        .replace(/--[^\n]*/g, "")
        .replace(/'(?:[^']|'')*'/g, "''");
      const callRegex = /\b(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
      const callees = new Set<string>();

      let call: RegExpExecArray | null;
      while ((call = callRegex.exec(body)) !== null) {
        const callee = normalizeFunctionName(call[1]);
        if (callee !== fn.name && knownFunctions.has(callee)) {
          callees.add(callee);
          observedCallees.add(callee);
        }
      }

      for (const callee of callees) {
        if (!grantedAuthenticated.has(callee)) {
          missingGrants.push(`${fn.name} -> ${callee}`);
        }
      }
    }

    expect([...observedCallees].sort()).toEqual(
      expect.arrayContaining([
        "at_timezone_or_null",
        "encrypted_notification_body",
      ]),
    );

    expect(
      missingGrants,
      `SECURITY INVOKER triggers/RPCs call these functions as authenticated, but they lack "GRANT EXECUTE ... TO authenticated" in supabase/schema.sql:\n${missingGrants
        .map((call) => ` - ${call}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("verifies all client-called RPCs in src/ and app/ have explicit GRANT EXECUTE ... TO authenticated in schema.sql", () => {
    const srcDir = path.join(rootDir, "src");
    const appDir = path.join(rootDir, "app");
    const clientRpcs = findClientRpcCalls([srcDir, appDir]);
    expect(clientRpcs.length).toBeGreaterThan(0);

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

  it("prevents later migrations from revoking only PUBLIC on functions", () => {
    const migrationsDir = path.join(rootDir, "supabase/migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql") && file > FIX_MIGRATION)
      .sort();
    const violations: string[] = [];

    for (const file of migrationFiles) {
      const migrationSql = fs.readFileSync(
        path.join(migrationsDir, file),
        "utf8",
      );
      for (const acl of extractAclStatements(migrationSql)) {
        if (acl.kind === "GRANT" && acl.roles.includes("ANON")) {
          violations.push(
            `${file}: grants execute to anon on ${acl.functionName}`,
          );
        }
        if (
          acl.kind === "REVOKE" &&
          acl.roles.includes("PUBLIC") &&
          !acl.roles.includes("ANON")
        ) {
          violations.push(
            `${file}: revokes ${acl.functionName} from PUBLIC without anon`,
          );
        }
      }
    }

    expect(
      violations,
      `Migrations after ${FIX_MIGRATION} reintroduced the PUBLIC-only grant pattern:\n${violations
        .map((violation) => ` - ${violation}`)
        .join("\n")}`,
    ).toEqual([]);
  });
});
