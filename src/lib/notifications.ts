import { keyStore } from "@/lib/crypto/keyStore";
import { decryptField } from "@/lib/crypto/contentCipher";

export interface EncryptedNotificationBody {
  template: string;
  ciphertext: string;
}

const PLACEHOLDER = "{}";

export interface NotificationDisplayOptions extends NotificationOptions {
  vibrate?: number[];
  actions?: Array<{ action: string; title: string; icon?: string }>;
  renotify?: boolean;
  encrypted?: EncryptedNotificationBody;
  encryptedTitle?: EncryptedNotificationBody;
}

export const DEFAULT_NOTIFICATION_OPTIONS: NotificationDisplayOptions = {
  icon: "/icons/icon-192.png",
  badge: "/icons/icon-192.png",
  vibrate: [200, 100, 200],
};

// WebKit does not coalesce tags or honour renotify (WebKit bug #258922).
export async function displayNotification(
  registration: ServiceWorkerRegistration,
  title: string,
  options?: NotificationDisplayOptions,
): Promise<void> {
  if (options?.tag) {
    await closeNotificationsWithTag(registration, options.tag);
  }

  const { encrypted, encryptedTitle, ...displayable } = options ?? {};
  const [resolvedTitle, resolvedBody] = await Promise.all([
    encryptedTitle
      ? resolveEncryptedField(encryptedTitle, title, "title")
      : title,
    encrypted
      ? resolveEncryptedField(encrypted, displayable.body, "body")
      : displayable.body,
  ]);
  displayable.body = resolvedBody;

  await registration.showNotification(resolvedTitle, {
    ...DEFAULT_NOTIFICATION_OPTIONS,
    ...displayable,
  } as NotificationOptions);
}

async function resolveEncryptedField<T extends string | undefined>(
  encrypted: EncryptedNotificationBody,
  fallback: T,
  fieldName: string,
): Promise<T> {
  try {
    const key = await keyStore.load();
    if (!key) return fallback;
    const plaintext = await decryptField(key, encrypted.ciphertext);
    // Function replacer avoids interpreting "$" in plaintext as special replacement patterns.
    return encrypted.template.replace(PLACEHOLDER, () => plaintext) as T;
  } catch (err) {
    console.warn(
      `[notifications] Could not decrypt notification ${fieldName}`,
      err,
    );
    return fallback;
  }
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
    console.warn(
      "[notifications] Could not close superseded notifications",
      err,
    );
    return;
  }
}
