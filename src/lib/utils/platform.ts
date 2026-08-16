export const getPlatformKey = () => {
  if (typeof window === "undefined") return "Ctrl";
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return isMac ? "⌘" : "Ctrl";
};

interface UserAgentDataBrand {
  brand: string;
  version: string;
}

interface NavigatorUAData {
  brands?: UserAgentDataBrand[];
  platform?: string;
}

// An installed Android PWA has no process of its own, so Chrome is what
// actually receives and must wake for push — this gates the battery-
// optimization hint to the one browser it's actually about.
export function isAndroidChrome(): boolean {
  if (typeof navigator === "undefined") return false;

  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData })
    .userAgentData;

  if (uaData?.brands?.length && uaData.platform) {
    const isChromeBrand = uaData.brands.some(
      (b) => b.brand === "Google Chrome" || b.brand === "Chromium",
    );
    return uaData.platform === "Android" && isChromeBrand;
  }

  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  // Other Chromium-based Android browsers (Samsung Internet, Edge, Opera)
  // and Firefox for Android all carry a "Chrome/" token in their UA string.
  const isChrome =
    /Chrome\//i.test(ua) && !/SamsungBrowser|EdgA|OPR|Firefox/i.test(ua);

  return isAndroid && isChrome;
}

// iPadOS reports as "MacIntel" in `navigator.platform` but exposes touch
// support, which desktop Macs don't — the standard way to tell them apart.
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  if (/iPhone|iPod|iPad/i.test(ua)) return true;

  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // `display-mode: standalone` also works on iOS 12.2+, but `standalone` is
  // the one signal specific to iOS Safari — keep it as a fallback.
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function supportsInstallPrompt(): boolean {
  if (typeof window === "undefined") return false;
  return "onbeforeinstallprompt" in window;
}
