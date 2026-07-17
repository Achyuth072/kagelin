/**
 * Error classification utilities for the uhabits import flow.
 *
 * Separates WASM initialization failures (infrastructure) from schema/data
 * errors so the UI can surface an actionable message.
 */

export const WASM_ERROR_MESSAGE =
  "Failed to load the SQLite engine. This is a browser or network configuration issue, not a problem with your .db file. Please try again or use a different browser.";

export const SCHEMA_ERROR_MESSAGE =
  "Failed to import Loop Habit Tracker data. Ensure it is a valid .db file.";

export const SAVE_ERROR_MESSAGE =
  "Your file was read correctly, but saving the imported data failed. Please try again.";

/**
 * Patterns that indicate a WASM loading failure rather than a db schema error.
 *
 * The magic-word/MIME entries catch the case where the wasm request is served
 * something else (e.g. an HTML login page) and the browser tries to compile it:
 * `3c 21 44 4f` is `<!DO`, the opening of `<!DOCTYPE html>`.
 */
const WASM_ERROR_PATTERNS = [
  "wasm streaming compile failed",
  "both async and sync fetching of the wasm failed",
  "failed to asynchronously prepare wasm",
  "aborted(both async and sync fetching",
  "expected magic word",
  "failed to match magic number",
  "wasm validation error",
  "unsupported mime type",
  "incorrect response mime type",
  "application/wasm",
];

/**
 * Classify an error thrown during uhabits import.
 *
 * Returns `WASM_ERROR_MESSAGE` when the error is a WASM loading failure,
 * `SCHEMA_ERROR_MESSAGE` for any other error (wrong schema, corrupt file, etc.).
 */
export function classifyUhabitsError(err: unknown): string {
  if (!(err instanceof Error)) return SCHEMA_ERROR_MESSAGE;

  const msg = err.message.toLowerCase();
  if (WASM_ERROR_PATTERNS.some((pattern) => msg.includes(pattern))) {
    return WASM_ERROR_MESSAGE;
  }

  return SCHEMA_ERROR_MESSAGE;
}
