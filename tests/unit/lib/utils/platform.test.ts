import { describe, it, expect, afterEach } from "vitest";
import { isAndroidChrome } from "@/lib/utils/platform";

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
