/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { keyStore, type Keyring } from "@/lib/crypto/keyStore";
import { keyForEnvelope } from "@/lib/crypto/keyring";
import {
  encryptField,
  decryptField,
  isCiphertext,
} from "@/lib/crypto/contentCipher";
import { SCHEME_V2, type Binding } from "@/lib/crypto/envelope";
import { FIELD_MAP, JSON_FIELDS, type FieldMap } from "@/lib/supabase/fieldMap";

interface WrapContext {
  fieldMap: FieldMap;
  // Row-bound ciphertext is bound to the session's user, not to a row column (habit_entries has none).
  getUserId: () => Promise<string | null>;
}

// Intercepts `.from(...)` queries only; `.channel` and `.rpc` bypass encryption.
export function wrapSupabaseClient<T extends SupabaseClient>(
  client: T,
  fieldMap: FieldMap = FIELD_MAP,
): T {
  const ctx: WrapContext = {
    fieldMap,
    getUserId: async () =>
      (await client.auth.getSession()).data.session?.user.id ?? null,
  };
  return new Proxy(client, {
    get(target, prop, _receiver) {
      if (prop === "from") {
        return (table: string) =>
          wrapQueryBuilder((target as any).from(table), String(table), ctx);
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ReadLoaders {
  keyring: () => Promise<Keyring | null>;
  userId: () => Promise<string | null>;
}

function createReadLoaders(ctx: WrapContext): ReadLoaders {
  let keyring: Promise<Keyring | null> | null = null;
  let userId: Promise<string | null> | null = null;
  return {
    keyring: () => (keyring ??= keyStore.loadKeyring()),
    userId: () => (userId ??= ctx.getUserId()),
  };
}

export const MISSING_ROW_ID_CODE = "missing_row_id";

// Row-bound ciphertext needs the row id before encryption, so the database default cannot supply it.
function missingRowIdError(table: string) {
  return Object.assign(
    new Error(
      `Cannot write to "${table}" without a client-generated id on every row.`,
    ),
    { code: MISSING_ROW_ID_CODE },
  );
}

function assertRowIds(table: string, fieldMap: FieldMap, values: unknown) {
  if (!fieldMap[table]?.length) return;
  const rows = Array.isArray(values) ? values : [values];
  const idless = rows.some(
    (row) => !isPlainObject(row) || typeof row.id !== "string" || !row.id,
  );
  if (idless) throw missingRowIdError(table);
}

export function isJsonField(table: string, field: string): boolean {
  return JSON_FIELDS.has(`${table}.${field}`);
}

// Thrown on missing or locked content key, unlike PostgREST's resolved { data, error }.
export const CONTENT_KEY_UNAVAILABLE_CODE = "content_key_unavailable";

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

export function isContentKeyUnavailableError(error: unknown): boolean {
  return hasErrorCode(error, CONTENT_KEY_UNAVAILABLE_CODE);
}

function contentKeyUnavailableError(
  action: "write to" | "read",
  table: string,
) {
  return Object.assign(
    new Error(
      `Cannot ${action} "${table}": content encryption is set up for this ` +
        "account but the master key is unavailable (locked, or not yet unlocked on this device).",
    ),
    { code: CONTENT_KEY_UNAVAILABLE_CODE },
  );
}

export function needsEncryption(
  table: string,
  field: string,
  value: unknown,
): boolean {
  if (isCiphertext(value)) return false;
  return isJsonField(table, field) ? value != null : typeof value === "string";
}

function rowNeedsEncryption(
  table: string,
  row: unknown,
  fields: readonly string[],
): boolean {
  return (
    isPlainObject(row) &&
    fields.some((field) => needsEncryption(table, field, row[field]))
  );
}

// Server rejection hints mapped to the client error each one is thrown as. Thrown, like a
// locked key, because most call sites rethrow only error.message and would drop the code.
const SERVER_HINT_ERRORS: Record<string, { code: string; message: string }> = {
  // The server's marker of a finished upgrade rejects `-v1` writes from a stale app.
  sealing_scheme_outdated: {
    code: "app_update_required",
    message: "Kagelin has been updated. Reload the app to keep saving.",
  },
  // The server's rejection of a write sealed with a key the Account has rotated away from.
  content_key_retired: {
    code: CONTENT_KEY_UNAVAILABLE_CODE,
    message: "Your content key changed. Unlock again to keep saving.",
  },
};

interface SealContext {
  key: Uint8Array;
  keyId: string;
  userId: string;
  // Updates carry no id in their payload; it comes from the `.eq("id", ...)` filter.
  fallbackRowId?: string;
}

async function encryptRow(
  table: string,
  fields: readonly string[],
  row: unknown,
  seal: SealContext,
): Promise<unknown> {
  if (!isPlainObject(row)) return row;

  const out = { ...row };
  const rowId = typeof row.id === "string" ? row.id : seal.fallbackRowId;
  for (const field of fields) {
    const value = row[field];
    if (needsEncryption(table, field, value)) {
      if (!rowId) throw missingRowIdError(table);
      out[field] = await encryptField(
        seal.key,
        isJsonField(table, field) ? JSON.stringify(value) : (value as string),
        { userId: seal.userId, table, column: field, rowId },
        seal.keyId,
      );
    }
  }
  return out;
}

export interface EncryptPayloadOptions {
  userId?: string;
  rowId?: string;
}

// Shared with call sites that write via the service-role client, which
// bypasses wrapSupabaseClient's automatic encryption (see connectCalendars).
export async function encryptPayload(
  table: string,
  values: unknown,
  fieldMap: FieldMap = FIELD_MAP,
  options: EncryptPayloadOptions = {},
): Promise<unknown> {
  const fields = fieldMap[table];
  if (!fields?.length) return values;

  const rows = Array.isArray(values) ? values : [values];
  if (!rows.some((row) => rowNeedsEncryption(table, row, fields))) {
    return values;
  }

  const keyring = await keyStore.loadKeyring();
  const userId = options.userId ?? (await keyStore.loadUserId());
  if (!keyring || !userId) {
    throw contentKeyUnavailableError("write to", table);
  }

  const seal: SealContext = {
    key: keyring.key,
    keyId: keyring.keyId,
    userId,
    fallbackRowId: options.rowId,
  };
  if (Array.isArray(values)) {
    return Promise.all(
      values.map((row) => encryptRow(table, fields, row, seal)),
    );
  }
  return encryptRow(table, fields, values, seal);
}

async function bindingFor(
  table: string,
  field: string,
  row: Record<string, unknown>,
  loaders: ReadLoaders,
): Promise<Binding | undefined> {
  if (!(row[field] as string).startsWith(`${SCHEME_V2}:`)) return undefined;
  const userId = await loaders.userId();
  if (!userId || typeof row.id !== "string") return undefined;
  return { userId, table, column: field, rowId: row.id };
}

async function decryptRow(
  table: string,
  ctx: WrapContext,
  row: unknown,
  loaders: ReadLoaders,
): Promise<unknown> {
  if (!isPlainObject(row)) return row;

  let out: Record<string, unknown> = row;
  const fields = ctx.fieldMap[table];
  if (fields?.length) {
    const encryptedFields = fields.filter((field) => isCiphertext(out[field]));
    if (encryptedFields.length) {
      const keyring = await loaders.keyring();
      if (!keyring) {
        throw contentKeyUnavailableError("read", table);
      }
      const decrypted = await Promise.all(
        encryptedFields.map(async (field) => {
          const key = keyForEnvelope(keyring, out[field] as string);
          if (!key) throw contentKeyUnavailableError("read", table);
          const plaintext = await decryptField(
            key,
            out[field] as string,
            await bindingFor(table, field, row, loaders),
          );
          return [
            field,
            isJsonField(table, field) ? JSON.parse(plaintext) : plaintext,
          ] as const;
        }),
      );
      out = { ...row };
      for (const [field, value] of decrypted) out[field] = value;
    }
  }

  for (const [column, value] of Object.entries(out)) {
    if (Array.isArray(value)) {
      if (!value.some(isPlainObject)) continue;
      const nested = await Promise.all(
        value.map((item) => decryptRow(column, ctx, item, loaders)),
      );
      if (out === row) out = { ...row };
      out[column] = nested;
    } else if (isPlainObject(value)) {
      const nested = await decryptRow(column, ctx, value, loaders);
      if (nested !== value) {
        if (out === row) out = { ...row };
        out[column] = nested;
      }
    }
  }

  return out;
}

async function decryptResult(
  table: string,
  ctx: WrapContext,
  result: any,
): Promise<any> {
  if (isPlainObject(result) && isPlainObject(result.error)) {
    const mapped =
      typeof result.error.hint === "string"
        ? SERVER_HINT_ERRORS[result.error.hint]
        : undefined;
    if (mapped) {
      throw Object.assign(new Error(mapped.message), result.error, mapped);
    }
    return result;
  }
  if (!isPlainObject(result) || result.error || result.data == null) {
    return result;
  }
  const loaders = createReadLoaders(ctx);
  const data = Array.isArray(result.data)
    ? await Promise.all(
        result.data.map((row: unknown) => decryptRow(table, ctx, row, loaders)),
      )
    : await decryptRow(table, ctx, result.data, loaders);
  return { ...result, data };
}

function wrapFilterBuilder(builder: any, table: string, ctx: WrapContext): any {
  const proxy: any = new Proxy(builder, {
    get(target, prop, _receiver) {
      if (prop === "then") {
        return (onFulfilled?: any, onRejected?: any) =>
          Promise.resolve(target)
            .then((result: any) => decryptResult(table, ctx, result))
            .then(onFulfilled, onRejected);
      }
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        return result === target
          ? proxy
          : wrapFilterBuilder(result, table, ctx);
      };
    },
  });
  return proxy;
}

interface PendingOp {
  prop: string;
  args: unknown[];
}

function idFilter(ops: PendingOp[]): string | undefined {
  const op = ops.find((o) => o.prop === "eq" && o.args[0] === "id");
  return typeof op?.args[1] === "string" ? op.args[1] : undefined;
}

// PostgREST chaining is synchronous, but payload encryption is async.
function wrapPendingBuilder(
  table: string,
  ctx: WrapContext,
  // Boxed in an object so Promise resolution does not auto-await the PostgREST thenable.
  resolveReal: (ops: PendingOp[]) => Promise<{ builder: any }>,
): any {
  const ops: PendingOp[] = [];
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled?: any, onRejected?: any) =>
            resolveReal(ops)
              .then(({ builder }) =>
                ops.reduce((acc, op) => acc[op.prop](...op.args), builder),
              )
              .then((result: any) => decryptResult(table, ctx, result))
              .then(onFulfilled, onRejected);
        }
        return (...args: unknown[]) => {
          ops.push({ prop: String(prop), args });
          return proxy;
        };
      },
    },
  );
  return proxy;
}

function wrapQueryBuilder(builder: any, table: string, ctx: WrapContext): any {
  return new Proxy(builder, {
    get(target, prop, _receiver) {
      if (prop === "insert" || prop === "update" || prop === "upsert") {
        const method = prop;
        return (values: unknown, options?: unknown) =>
          wrapPendingBuilder(table, ctx, async (ops) => {
            if (method !== "update") {
              assertRowIds(table, ctx.fieldMap, values);
            }
            const encrypted = await encryptPayload(
              table,
              values,
              ctx.fieldMap,
              {
                userId: (await ctx.getUserId()) ?? undefined,
                rowId: method === "update" ? idFilter(ops) : undefined,
              },
            );
            return { builder: target[method](encrypted, options) };
          });
      }
      const value = Reflect.get(target, prop, target);
      if (typeof value !== "function") return value;
      const bound = value.bind(target);
      if (prop === "select" || prop === "delete") {
        return (...args: unknown[]) =>
          wrapFilterBuilder(bound(...args), table, ctx);
      }
      return bound;
    },
  });
}
