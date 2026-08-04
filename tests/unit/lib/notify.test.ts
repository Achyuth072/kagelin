import { describe, it, expect, vi, beforeEach } from "vitest";

const { toastMock } = vi.hoisted(() => {
  const toastMock = vi.fn() as unknown as typeof import("sonner").toast;
  Object.assign(toastMock, {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  });
  return { toastMock };
});

vi.mock("sonner", () => ({ toast: toastMock }));

import { notify } from "@/lib/notify";

describe("notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates the base callable form to sonner's toast", () => {
    notify("Session cancelled", { duration: 1500 });
    expect(toastMock).toHaveBeenCalledWith("Session cancelled", {
      duration: 1500,
    });
  });

  it("delegates each severity method to the matching sonner method", () => {
    notify.success("ok", { id: "1" });
    expect(toastMock.success).toHaveBeenCalledWith("ok", { id: "1" });

    notify.error("bad", { id: "2" });
    expect(toastMock.error).toHaveBeenCalledWith("bad", { id: "2" });

    notify.warning("careful");
    expect(toastMock.warning).toHaveBeenCalledWith("careful", undefined);

    notify.info("fyi");
    expect(toastMock.info).toHaveBeenCalledWith("fyi", undefined);

    notify.loading("working...");
    expect(toastMock.loading).toHaveBeenCalledWith("working...", undefined);

    notify.dismiss("1");
    expect(toastMock.dismiss).toHaveBeenCalledWith("1");
  });

  it("rejects passing both description and action on the base form at compile time", () => {
    const invalid = {
      description: "d",
      action: { label: "L", onClick: () => {} },
    };
    // @ts-expect-error — description and action are mutually exclusive on the base form.
    notify("title", invalid);
  });

  it("still allows description alone or action alone on the base form", () => {
    notify("title", { description: "d" });
    notify("title", { action: { label: "L", onClick: () => {} } });
    expect(toastMock).toHaveBeenCalledTimes(2);
  });

  it("allows description on error but not action", () => {
    notify.error("bad", { description: "details" });
    // @ts-expect-error — error's options don't accept an action.
    notify.error("bad", { action: { label: "L", onClick: () => {} } });
    expect(toastMock.error).toHaveBeenCalledTimes(2);
  });
});
