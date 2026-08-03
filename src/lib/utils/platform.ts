export const getPlatformKey = () => {
  if (typeof window === "undefined") return "Ctrl"; // Default for SSR
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
