// Engine-specific fetch failure messages (Chrome, WebKit, Firefox).
const FETCH_FAILURE_MESSAGES = [
  "Failed to fetch",
  "Load failed",
  "NetworkError",
];

export function isFetchFailureMessage(message: string): boolean {
  return FETCH_FAILURE_MESSAGES.some((candidate) =>
    message.includes(candidate),
  );
}

// fetch rejects with TypeError on network failures; message check filters out runtime bugs.
export function isTransientNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  return error instanceof TypeError && isFetchFailureMessage(error.message);
}
