// Plain array so it survives the query persister (ADR 0023).
export interface MaybeUnreadable {
  unreadable?: readonly string[];
}

export function compareReadable(a: string | null, b: string | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return a.localeCompare(b);
}

export const UNREADABLE_CONTENT_CODE = "unreadable_content";

function unreadableContentError(): Error {
  return Object.assign(
    new Error(
      "This item has content that can't be read. Delete it or type a new value.",
    ),
    { code: UNREADABLE_CONTENT_CODE },
  );
}

// Rejects unreadable rows so writes do not blank null fields or fail NOT NULL constraints.
export function assertReadable(row: object): void {
  if ("unreadable" in row) throw unreadableContentError();
}

// A column the update sets is no longer unreadable, so it leaves the marker.
export function applyReadableUpdate<T extends object>(
  row: T,
  updates: object,
): T {
  const { unreadable, ...rest } = row as T & MaybeUnreadable;
  const merged = { ...rest, ...updates } as T;
  const fields = updates as Record<string, unknown>;
  const remaining = unreadable?.filter(
    (column) => fields[column] === undefined,
  );
  return remaining?.length ? { ...merged, unreadable: remaining } : merged;
}

// Forms seed an unreadable field empty, so an empty value is untouched; sending it would overwrite the damaged value.
export function omitUntouchedUnreadable<T extends object>(
  row: MaybeUnreadable,
  payload: T,
): T {
  const untouched = row.unreadable?.filter(
    (column) => !(payload as Record<string, unknown>)[column],
  );
  if (!untouched?.length) return payload;
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !untouched.includes(key)),
  ) as T;
}

export function isUnreadable(row: MaybeUnreadable, column: string): boolean {
  return row.unreadable?.includes(column) ?? false;
}

export function requireReadable(value: string | null): string {
  if (value === null) throw unreadableContentError();
  return value;
}
