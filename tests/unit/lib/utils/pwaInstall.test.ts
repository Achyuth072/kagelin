import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isInstallHintDismissed,
  dismissInstallHint,
  recordAppOpen,
  hasReachedOpenThreshold,
  shouldShowInstallBanner,
  shouldShowInstallRow,
  type InstallBannerEligibility,
  type InstallRowEligibility,
} from "@/lib/utils/pwaInstall";

describe("install hint dismissal + open count", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is not dismissed by default", () => {
    expect(isInstallHintDismissed()).toBe(false);
  });

  it("persists dismissal", () => {
    dismissInstallHint();
    expect(isInstallHintDismissed()).toBe(true);
  });

  it("increments the open count and returns it", () => {
    expect(recordAppOpen()).toBe(1);
    expect(recordAppOpen()).toBe(2);
    expect(recordAppOpen()).toBe(3);
  });

  it("has not reached the threshold before the 3rd open", () => {
    recordAppOpen();
    recordAppOpen();
    expect(hasReachedOpenThreshold()).toBe(false);
  });

  it("reaches the threshold on the 3rd open", () => {
    recordAppOpen();
    recordAppOpen();
    recordAppOpen();
    expect(hasReachedOpenThreshold()).toBe(true);
  });
});

describe("shouldShowInstallBanner", () => {
  const eligible: InstallBannerEligibility = {
    isInstalled: false,
    isMobile: true,
    isIOS: false,
    canInstall: true,
    dismissed: false,
    openThresholdReached: true,
  };

  const cases: Array<[string, Partial<InstallBannerEligibility>, boolean]> = [
    ["all conditions met (Android, event captured)", {}, true],
    ["already installed", { isInstalled: true }, false],
    ["desktop (not mobile)", { isMobile: false }, false],
    ["previously dismissed", { dismissed: true }, false],
    [
      "hasn't reached the open threshold yet",
      { openThresholdReached: false },
      false,
    ],
    [
      "Android without a captured beforeinstallprompt event",
      { canInstall: false },
      false,
    ],
    [
      "iOS without a captured event (iOS never has one)",
      { isIOS: true, canInstall: false },
      true,
    ],
  ];

  it.each(cases)("%s -> %s", (_label, overrides, expected) => {
    expect(shouldShowInstallBanner({ ...eligible, ...overrides })).toBe(
      expected,
    );
  });
});

describe("shouldShowInstallRow", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "onbeforeinstallprompt");
  });

  const eligible: InstallRowEligibility = {
    isInstalled: false,
    isMobile: true,
    isIOS: false,
    canInstall: true,
  };

  const cases: Array<[string, Partial<InstallRowEligibility>, boolean]> = [
    ["mobile Android with a captured event", {}, true],
    ["already installed", { isInstalled: true }, false],
    ["mobile without a captured event", { canInstall: false }, true],
    [
      "iOS without a captured event (iOS never has one)",
      { isMobile: false, isIOS: true, canInstall: false },
      true,
    ],
    [
      "desktop with no install path (Firefox/Safari)",
      { isMobile: false, canInstall: false },
      false,
    ],
  ];

  it.each(cases)("%s -> %s", (_label, overrides, expected) => {
    expect(shouldShowInstallRow({ ...eligible, ...overrides })).toBe(expected);
  });

  it("falls back to onbeforeinstallprompt support on desktop Chromium (no event captured yet)", () => {
    Object.defineProperty(window, "onbeforeinstallprompt", {
      value: null,
      configurable: true,
    });
    expect(
      shouldShowInstallRow({
        isInstalled: false,
        isMobile: false,
        isIOS: false,
        canInstall: false,
      }),
    ).toBe(true);
  });
});
