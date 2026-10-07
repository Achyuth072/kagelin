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

export function requireReadable(value: string | null): string {
  if (value === null) throw unreadableContentError();
  return value;
}
