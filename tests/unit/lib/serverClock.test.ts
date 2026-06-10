import { describe, it, expect, afterEach, vi } from "vitest";
import {
  computeOffset,
  serverNow,
  setServerOffset,
} from "@/lib/store/serverClock";

/**
 * serverClock — RTT-corrected server time anchor for the deadline timer.
 *
 * computeOffset estimates `serverClock − localClock` from a single probe:
 * the server samples its time mid-flight, so the estimated server clock at
 * the moment the response lands (t1) is `serverMs + RTT/2`, and the offset
 * to add to a future `Date.now()` is that minus t1.
 */
describe("serverClock", () => {
  afterEach(() => {
    setServerOffset(0);
    vi.useRealTimers();
  });

  it("computeOffset applies RTT correction: serverMs + (t1 - t0) / 2 - t1", () => {
    // Given: probe sent at t0=1000, response with serverMs=10000 landed at t1=1100
    const offset = computeOffset(10000, 1000, 1100);

    // Then: offset = 10000 + 50 - 1100
    expect(offset).toBe(8950);
  });

  it("serverNow returns Date.now() + the configured offset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(2000);
    setServerOffset(8950);

    expect(serverNow()).toBe(10950);
  });
});
