// Some envs' NotificationOptions type is missing these.
export interface NotificationDisplayOptions extends NotificationOptions {
  vibrate?: number[];
  actions?: Array<{ action: string; title: string; icon?: string }>;
  renotify?: boolean;
}

export const DEFAULT_NOTIFICATION_OPTIONS: NotificationDisplayOptions = {
  icon: "/icons/icon-192.png",
  badge: "/icons/icon-192.png",
  vibrate: [200, 100, 200],
};

// Every display goes through here rather than registration.showNotification:
// WebKit never implemented tag coalescing
// (https://bugs.webkit.org/show_bug.cgi?id=258922) and ignores `renotify`, so iOS
// stacks what Chrome replaces unless we close the predecessors ourselves.
export async function displayNotification(
  registration: ServiceWorkerRegistration,
  title: string,
  options?: NotificationDisplayOptions,
): Promise<void> {
  if (options?.tag) {
    await closeNotificationsWithTag(registration, options.tag);
  }

  await registration.showNotification(title, {
    ...DEFAULT_NOTIFICATION_OPTIONS,
    ...options,
  } as NotificationOptions);
}

async function closeNotificationsWithTag(
  registration: ServiceWorkerRegistration,
  tag: string,
): Promise<void> {
  try {
    const existing = await registration.getNotifications({ tag });
    for (const notification of existing) {
      notification.close();
    }
  } catch (err) {
    // A duplicate beats nothing: on iOS a push that shows nothing costs the subscription.
    console.warn(
      "[notifications] Could not close superseded notifications",
      err,
    );
    return;
  }
}
