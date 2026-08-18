import { describe, it, expect, afterEach } from "vitest";
import {
  isAndroidChrome,
  isIOS,
  isStandalone,
  supportsInstallPrompt,
} from "@/lib/utils/platform";

describe("isAndroidChrome", () => {
  const setUserAgent = (ua: string) => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: ua,
      configurable: true,
    });
  };

  afterEach(() => {
    setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/1.0.0.0 Safari/537.36",
    );
    Object.defineProperty(window.navigator, "userAgentData", {
      value: undefined,
      configurable: true,
    });
  });

  const cases: Array<[string, string, boolean]> = [
    [
      "Android Chrome",
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
      true,
    ],
    [
      "Android Firefox",
      "Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/119.0 Firefox/119.0",
      false,
    ],
    [
      "desktop Chrome",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      false,
    ],
    [
      "iOS Safari",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      false,
    ],
    [
      "iOS Chrome (CriOS runs on WebKit, not the affected engine)",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1",
      false,
    ],
    [
      "Samsung Internet (carries a Chrome/ token but is not Chrome)",
      "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
      false,
    ],
    [
      "Android Edge (carries a Chrome/ token but is not Chrome)",
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 EdgA/119.0.0.0",
      false,
    ],
  ];

  it.each(cases)("%s -> %s", (_label, ua, expected) => {
    setUserAgent(ua);
    expect(isAndroidChrome()).toBe(expected);
  });

  it("prefers userAgentData over the UA string when both are present", () => {
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
    );
    Object.defineProperty(window.navigator, "userAgentData", {
      value: {
        brands: [{ brand: "Not.A/Brand", version: "8" }],
        platform: "Windows",
      },
      configurable: true,
    });

    expect(isAndroidChrome()).toBe(false);
  });

  it("recognizes Android Chrome via userAgentData brands", () => {
    Object.defineProperty(window.navigator, "userAgentData", {
      value: {
        brands: [
          { brand: "Not.A/Brand", version: "8" },
          { brand: "Chromium", version: "119" },
          { brand: "Google Chrome", version: "119" },
        ],
        platform: "Android",
      },
      configurable: true,
    });

    expect(isAndroidChrome()).toBe(true);
  });
});

describe("isIOS", () => {
  const setUserAgent = (ua: string) => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: ua,
      configurable: true,
    });
  };
  const setPlatform = (platform: string) => {
    Object.defineProperty(window.navigator, "platform", {
      value: platform,
      configurable: true,
    });
  };
  const setMaxTouchPoints = (points: number) => {
    Object.defineProperty(window.navigator, "maxTouchPoints", {
      value: points,
      configurable: true,
    });
  };

  afterEach(() => {
    setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/1.0.0.0 Safari/537.36",
    );
    setPlatform("Linux x86_64");
    setMaxTouchPoints(0);
  });

  const cases: Array<[string, string, string, number, boolean]> = [
    [
      "iPhone Safari",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "iPhone",
      5,
      true,
    ],
    [
      "iPad Safari (modern UA reports MacIntel)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "MacIntel",
      5,
      true,
    ],
    [
      "desktop Mac Safari (no touch)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "MacIntel",
      0,
      false,
    ],
    [
      "Android Chrome",
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
      "Linux armv8l",
      5,
      false,
    ],
    [
      "desktop Windows Chrome",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      "Win32",
      0,
      false,
    ],
  ];

  it.each(cases)("%s -> %s", (_label, ua, platform, touchPoints, expected) => {
    setUserAgent(ua);
    setPlatform(platform);
    setMaxTouchPoints(touchPoints);
    expect(isIOS()).toBe(expected);
  });
});

describe("isStandalone", () => {
  const setSignals = (
    displayModeStandalone: boolean,
    navigatorStandalone?: boolean,
  ) => {
    window.matchMedia = ((query: string) => ({
      matches: query === "(display-mode: standalone)" && displayModeStandalone,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    Object.defineProperty(window.navigator, "standalone", {
      value: navigatorStandalone,
      configurable: true,
    });
  };

  const cases: Array<[string, boolean, boolean | undefined, boolean]> = [
    ["display-mode: standalone matches", true, undefined, true],
    ["navigator.standalone is true (iOS)", false, true, true],
    ["neither signal is set", false, undefined, false],
    ["navigator.standalone is explicitly false", false, false, false],
  ];

  it.each(cases)(
    "%s -> %s",
    (_label, displayModeStandalone, navigatorStandalone, expected) => {
      setSignals(displayModeStandalone, navigatorStandalone);
      expect(isStandalone()).toBe(expected);
    },
  );
});

describe("supportsInstallPrompt", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "onbeforeinstallprompt");
  });

  it("is true when the browser exposes onbeforeinstallprompt (Chromium)", () => {
    Object.defineProperty(window, "onbeforeinstallprompt", {
      value: null,
      configurable: true,
    });
    expect(supportsInstallPrompt()).toBe(true);
  });

  it("is false when the browser doesn't expose it (Firefox/Safari)", () => {
    Reflect.deleteProperty(window, "onbeforeinstallprompt");
    expect(supportsInstallPrompt()).toBe(false);
  });
});
