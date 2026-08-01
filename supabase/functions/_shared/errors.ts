// No Deno/Node APIs — tests/unit imports this directly.

// PostgrestError carries `message` without being an Error, so instanceof alone misses it.
export function toErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "Unknown error";
}
