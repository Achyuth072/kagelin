import { keyStore, type Keyring } from "@/lib/crypto/keyStore";
import { keyForEnvelope } from "@/lib/crypto/keyring";
import { decryptField } from "@/lib/crypto/contentCipher";
import type { Binding } from "@/lib/crypto/envelope";
import type { HabitType } from "@/lib/types/habit";
import type { ReminderType } from "@/lib/types/notification";

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
  habitKind?: HabitType;
  reminderType?: ReminderType;
  recurring?: boolean;
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

  const {
    encrypted,
    encryptedTitle,
    habitKind,
    reminderType,
    recurring,
    ...displayable
  } = options ?? {};

  const key = encrypted || encryptedTitle ? await loadKeyOrNull() : null;
  const userId = key ? await keyStore.loadUserId() : null;
  const bindingFor = (role: "title" | "body") =>
    sourceBinding(userId, displayable.data, role);

  const [decryptedTitle, decryptedBody] = await Promise.all([
    encryptedTitle
      ? resolveEncryptedField(key, encryptedTitle, "title", bindingFor("title"))
      : title,
    encrypted
      ? resolveEncryptedField(key, encrypted, "body", bindingFor("body"))
      : displayable.body,
  ]);

  // Only a device that decrypted the item's name is unlocked enough to act blindly.
  const decryptedAll = decryptedTitle !== null && decryptedBody !== null;
  if (!displayable.actions) {
    if (habitKind && encryptedTitle !== undefined && decryptedAll) {
      displayable.actions = HABIT_ACTIONS[habitKind];
    } else if (reminderType && encrypted !== undefined && decryptedAll) {
      displayable.actions = reminderActions(reminderType, recurring);
    }
  }

  await registration.showNotification(decryptedTitle ?? title, {
    ...DEFAULT_NOTIFICATION_OPTIONS,
    ...displayable,
    body: decryptedBody ?? displayable.body,
  } as NotificationOptions);
}

const HABIT_ACTIONS = {
  boolean: [
    { action: "done", title: "Done" },
    { action: "skip", title: "Skip" },
  ],
  measurable: [{ action: "skip", title: "Skip" }],
};

const SNOOZE_ACTION = { action: "snooze", title: "Snooze" };

// A recurring task's Done must create the next Occurrence, which only the app can do.
function reminderActions(type: ReminderType, recurring?: boolean) {
  if (type === "event_reminder" || recurring) return [SNOOZE_ACTION];
  return [{ action: "done", title: "Done" }, SNOOZE_ACTION];
}

// Notification copies are bound to the source row, not the queue row, so a copy lifted from another row fails.
export function sourceBinding(
  userId: string | null,
  data: unknown,
  role: "title" | "body",
): Binding | undefined {
  if (!userId || typeof data !== "object" || data === null) return undefined;
  const { habitId, taskId, eventId } = data as Record<string, unknown>;
  if (typeof habitId === "string") {
    const column = role === "title" ? "name" : "question";
    return { userId, table: "habits", column, rowId: habitId };
  }
  if (typeof taskId === "string") {
    return { userId, table: "tasks", column: "content", rowId: taskId };
  }
  if (typeof eventId === "string") {
    return {
      userId,
      table: "calendar_events",
      column: "title",
      rowId: eventId,
    };
  }
  return undefined;
}

async function loadKeyOrNull(): Promise<Keyring | null> {
  try {
    return await keyStore.loadKeyring();
  } catch (err) {
    console.warn("[notifications] Could not load the content key", err);
    return null;
  }
}

// Returns null when the field cannot be shown decrypted.
async function resolveEncryptedField(
  key: Keyring | null,
  encrypted: EncryptedNotificationBody,
  fieldName: string,
  binding: Binding | undefined,
): Promise<string | null> {
  const openingKey = key && keyForEnvelope(key, encrypted.ciphertext);
  if (!openingKey) return null;
  try {
    const plaintext = await decryptField(
      openingKey,
      encrypted.ciphertext,
      binding,
    );
    // Function replacer avoids interpreting "$" in plaintext as special replacement patterns.
    return encrypted.template.replace(PLACEHOLDER, () => plaintext);
  } catch (err) {
    console.warn(
      `[notifications] Could not decrypt notification ${fieldName}`,
      err,
    );
    return null;
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
