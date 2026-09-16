import type { QueryClient } from "@tanstack/react-query";
import { keyStore } from "@/lib/crypto/keyStore";
import { purgePersistedQueryCache } from "@/lib/query-cache-purge";

// Notifications in the OS tray retain decrypted plaintext until dismissed or closed.
async function closeDisplayedNotifications(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const notifications = await registration.getNotifications();
  notifications.forEach((notification) => notification.close());
}

// Unified purge for lock and sign-out so cleanup cannot drift apart.
export async function purgeDeviceContent(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    keyStore.clear(),
    purgePersistedQueryCache(queryClient),
    closeDisplayedNotifications(),
  ]);
}
