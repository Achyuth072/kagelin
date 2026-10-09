import { notify } from "@/lib/notify";
import {
  isContentKeyRetiredError,
  isContentKeyUnavailableError,
  type ServerKeySignal,
} from "@/lib/supabase/wrapClient";

let updateToastShown = false;

// A failed save is usually one of many at once; one sticky toast is enough until reload.
export function handleServerKeySignal(signal: ServerKeySignal) {
  if (signal !== "app_update_required" || updateToastShown) return;
  updateToastShown = true;
  notify("Kagelin has been updated. Reload to keep saving.", {
    duration: Infinity,
    action: { label: "Reload", onClick: () => window.location.reload() },
  });
}

export function handleMutationError(err: unknown) {
  // The gate locks the device and its unlock screen explains why.
  if (isContentKeyRetiredError(err)) return;

  if (isContentKeyUnavailableError(err)) {
    notify.error("Content is locked — unlock the app to save changes.");
    return;
  }

  if (err instanceof TypeError && err.message === "Failed to fetch") {
    notify.error("Network Error. Changes could not be saved.");
    return;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    if (
      msg.includes("401") ||
      msg.includes("not authenticated") ||
      msg.includes("unauthorized")
    ) {
      notify.error("Authentication error. Please log in again.");
      return;
    }

    notify.error(err.message || "An error occurred.");
    return;
  }

  notify.error("An unexpected error occurred.");
}
