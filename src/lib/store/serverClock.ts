"use client";

/**
 * serverClock — a process-wide anchor that converts the local wall clock into
 * server time for the deadline-based focus timer.
 *
 * The timer stores an absolute deadline (`endsAt`, epoch ms). For two devices
 * to agree on the remaining time, they must agree on "now" — but device clocks
 * drift and can jump on wake. We probe Postgres time once per connect (and on
 * visibility/resubscribe) and keep the offset `serverClock − localClock` here.
 */

let serverOffsetMs = 0;
// Until the offset has been probed from the server, `serverNow()` is just the
// (possibly skewed) local clock. Callers that take irreversible actions on the
// deadline — e.g. completing a timer — must wait for this to flip true.
let serverClockReady = false;

/**
 * computeOffset — derive `serverClock − localClock` from one RTT-corrected probe.
 *
 * @param serverMs epoch ms reported by the server (`server_now_ms()`)
 * @param t0 `Date.now()` immediately before the probe was sent
 * @param t1 `Date.now()` immediately after the response landed
 *
 * The server samples its clock mid-flight, so the estimated server clock at t1
 * is `serverMs + RTT/2`; the offset to add to any later `Date.now()` is that
 * minus t1.
 */
export function computeOffset(
  serverMs: number,
  t0: number,
  t1: number,
): number {
  return serverMs + (t1 - t0) / 2 - t1;
}

export function setServerOffset(offsetMs: number): void {
  serverOffsetMs = offsetMs;
  serverClockReady = true;
}

export function getServerOffset(): number {
  return serverOffsetMs;
}

/** Whether the offset has been established from at least one server probe. */
export function isServerClockReady(): boolean {
  return serverClockReady;
}

/**
 * Reset the anchor to its unprobed state (offset 0, not ready). Test-only — the
 * module-level flag otherwise has no path back to false, which the probe
 * fallback regression needs to observe the false→true transition.
 */
export function resetServerClock(): void {
  serverOffsetMs = 0;
  serverClockReady = false;
}

/** serverNow — the current server time in epoch ms. */
export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}
