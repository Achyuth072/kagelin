import { describe, it, expect } from "vitest";
import { toErrorMessage } from "../../supabase/functions/_shared/errors";

describe("toErrorMessage", () => {
  it("keeps the text of a thrown Error", () => {
    expect(toErrorMessage(new Error("VAPID configuration missing"))).toBe(
      "VAPID configuration missing",
    );
  });

  it("keeps the text of a PostgrestError, which is not an Error instance", () => {
    expect(
      toErrorMessage({
        message: "permission denied for table notification_queue",
        code: "42501",
      }),
    ).toBe("permission denied for table notification_queue");
  });

  it("always yields a string, so recording a failure cannot itself throw", () => {
    for (const thrown of [null, undefined, 42, { code: "x" }, []]) {
      expect(typeof toErrorMessage(thrown)).toBe("string");
    }
  });
});
