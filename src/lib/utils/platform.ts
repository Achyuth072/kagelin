export const getPlatformKey = () => {
  if (typeof window === "undefined") return "Ctrl"; // Default for SSR
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return isMac ? "⌘" : "Ctrl";
};
