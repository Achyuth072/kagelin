"use client";

import { BatteryWarning, X } from "lucide-react";

export function AndroidBatteryHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"
    >
      <div className="flex items-start gap-2 min-w-0">
        <BatteryWarning
          className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500"
          strokeWidth={2.25}
        />
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <span className="font-medium">
            Notifications may arrive late on Android.
          </span>{" "}
          Chrome&apos;s battery optimization needs to be set to Unrestricted for
          pushes to reliably wake it on a locked, idle phone — this is
          Chrome&apos;s setting, not Kagelin&apos;s (an installed Android web
          app has no process of its own). Go to{" "}
          <span className="font-medium">
            Settings → Apps → Chrome → Battery → Unrestricted
          </span>
          . On Samsung, Xiaomi, OnePlus, or Oppo phones this setting is often
          hidden, renamed, or layered under the manufacturer&apos;s own
          app-killer — if it&apos;s not where expected, search your phone&apos;s
          Settings app for &quot;battery optimization&quot;.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
