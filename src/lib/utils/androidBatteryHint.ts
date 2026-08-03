export const ANDROID_BATTERY_HINT_STORAGE_KEY = "androidBatteryHintDismissed";

export function isAndroidBatteryHintDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ANDROID_BATTERY_HINT_STORAGE_KEY) === "true";
}

export function dismissAndroidBatteryHint(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ANDROID_BATTERY_HINT_STORAGE_KEY, "true");
}
