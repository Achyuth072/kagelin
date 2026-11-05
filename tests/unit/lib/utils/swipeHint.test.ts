import { describe, it, expect, beforeEach } from "vitest";
import { isSwipeHintDismissed, dismissSwipeHint } from "@/lib/utils/swipeHint";

describe("swipeHint utility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is not dismissed by default", () => {
    expect(isSwipeHintDismissed()).toBe(false);
  });

  it("persists dismissal to localStorage", () => {
    dismissSwipeHint();
    expect(isSwipeHintDismissed()).toBe(true);
  });
});
