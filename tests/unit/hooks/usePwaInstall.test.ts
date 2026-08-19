import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePwaInstall } from "@/lib/hooks/usePwaInstall";
import { trackTelemetry } from "@/lib/telemetry/client";

vi.mock("@/lib/telemetry/client", () => ({
  trackTelemetry: vi.fn(),
}));

vi.mock("@/lib/hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock("@/lib/utils/platform", () => ({
  isIOS: vi.fn(() => false),
  isStandalone: vi.fn(() => false),
  supportsInstallPrompt: vi.fn(() => false),
  getTelemetryPlatform: vi.fn(() => "desktop"),
}));

describe("usePwaInstall telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("fires pwa_installed telemetry when appinstalled window event triggers", () => {
    renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(trackTelemetry).toHaveBeenCalledWith("pwa_installed", {
      platform: "desktop",
    });
  });
});
