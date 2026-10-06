import type { NotificationDisplayOptions } from "@/lib/notifications";
import type { HabitType } from "@/lib/types/habit";
import type { ReminderType } from "@/lib/types/notification";
import { HABIT_ENTRY_UPDATED, habitPath } from "@/lib/habit-links";

export const TASKS_UPDATED = "TASKS_UPDATED";

export interface NotificationData {
  habitId?: string;
  date?: string;
  habitKind?: HabitType;
  taskId?: string;
  eventId?: string;
  reminderType?: ReminderType;
  recurring?: boolean;
  url?: string;
}

export interface NotificationClickDeps {
  fetch: typeof globalThis.fetch;
  clients: Clients;
  displayNotification: (
    registration: ServiceWorkerRegistration,
    title: string,
    options?: NotificationDisplayOptions,
  ) => Promise<void>;
  registration: ServiceWorkerRegistration;
  openWindow: (url: string) => Promise<WindowClient | null> | undefined;
}

export async function handleNotificationClick(
  action: string,
  data: NotificationData | undefined,
  notificationTag: string | undefined,
  deps: NotificationClickDeps,
): Promise<void> {
  if ((action === "done" || action === "skip") && data?.habitId && data?.date) {
    const state = action === "done" ? "done" : "skipped";
    await postAction(
      "/api/habits/entry",
      { habitId: data.habitId, date: data.date, state },
      { message: HABIT_ENTRY_UPDATED, failedItem: "habit" },
      data,
      notificationTag,
      deps,
    );
    return;
  }

  if (action === "done" && data?.taskId) {
    await postAction(
      "/api/tasks/complete",
      { taskId: data.taskId },
      { message: TASKS_UPDATED, failedItem: "task" },
      data,
      notificationTag,
      deps,
    );
    return;
  }

  const referenceId = data?.taskId ?? data?.eventId;
  if (action === "snooze" && data?.reminderType && referenceId) {
    await postAction(
      "/api/notifications/snooze",
      { type: data.reminderType, referenceId },
      { failedItem: data.eventId ? "event" : "task" },
      data,
      notificationTag,
      deps,
    );
    return;
  }

  const url = notificationUrl(data);
  for (const client of await matchWindows(deps)) {
    if (!("focus" in client)) continue;
    const { pathname, search } = new URL(client.url);
    const alreadyThere = pathname + search === url;
    if (alreadyThere) {
      await client.focus();
      return;
    }
    if ("navigate" in client) {
      const navigated = await (client as WindowClient).navigate(url).then(
        () => true,
        () => false,
      );
      if (navigated) {
        await client.focus();
        return;
      }
    }
  }

  await deps.openWindow(url);
}

async function postAction(
  path: string,
  body: Record<string, string>,
  outcome: { message?: string; failedItem: string },
  data: NotificationData,
  notificationTag: string | undefined,
  deps: NotificationClickDeps,
): Promise<void> {
  // Platform fetch throws "Illegal invocation" when called as a method of deps.
  const { fetch } = deps;
  const ok = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(
    (res) => res.ok,
    () => false,
  );

  if (!ok) {
    await deps.displayNotification(deps.registration, "Action not saved", {
      tag: notificationTag,
      body: `Could not save your response. Tap to open the ${outcome.failedItem}.`,
      data: { url: notificationUrl(data) },
    });
    return;
  }

  if (!outcome.message) return;
  for (const client of await matchWindows(deps)) {
    client.postMessage({ type: outcome.message });
  }
}

function notificationUrl(data: NotificationData | undefined): string {
  if (data?.habitId) return habitPath(data.habitId);
  return data?.url || "/";
}

function matchWindows(deps: NotificationClickDeps) {
  return deps.clients.matchAll({ type: "window", includeUncontrolled: true });
}
