// Shared by per-account stores (keyStore, migrationSnapshot) to avoid duplicating this guard.
export function hasUserId(value: unknown): value is { userId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { userId: string }).userId === "string"
  );
}
