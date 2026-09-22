export const WASM_ERROR_MESSAGE =
  "Failed to load the SQLite engine. This is a browser or network problem, not a problem with your .db file. Close the app completely, reopen it, and try again.";

export const SCHEMA_ERROR_MESSAGE =
  "Failed to import Loop Habit Tracker data. Ensure it is a valid .db file.";

export const SAVE_ERROR_MESSAGE =
  "Your file was read correctly, but saving the imported data failed. Please try again.";

// `3c 21 44 4f` is `<!DO`, the start of an HTML page served in place of the wasm.
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
  "compileerror",
  "webassembly",
];

export function isWasmDiagnostic(text: string): boolean {
  const lower = text.toLowerCase();
  return WASM_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function classifyUhabitsError(err: unknown): string {
  if (!(err instanceof Error)) return SCHEMA_ERROR_MESSAGE;

  return isWasmDiagnostic(err.message)
    ? WASM_ERROR_MESSAGE
    : SCHEMA_ERROR_MESSAGE;
}
