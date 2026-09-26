import type { NotificationDisplayOptions } from "@/lib/notifications";
import type { HabitType } from "@/lib/types/habit";
import { HABIT_ENTRY_UPDATED, habitPath } from "@/lib/habit-links";

export interface HabitNotificationData {
  habitId?: string;
  date?: string;
  habitKind?: HabitType;
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
  data: HabitNotificationData | undefined,
  notificationTag: string | undefined,
  deps: NotificationClickDeps,
): Promise<void> {
  if ((action === "done" || action === "skip") && data?.habitId && data?.date) {
    const state = action === "done" ? "done" : "skipped";
    // Platform fetch throws "Illegal invocation" when called as a method of deps.
    const { fetch } = deps;
    const ok = await fetch("/api/habits/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId: data.habitId, date: data.date, state }),
    }).then(
      (res) => res.ok,
      () => false,
    );

    if (ok) {
      for (const client of await matchWindows(deps)) {
        client.postMessage({ type: HABIT_ENTRY_UPDATED });
      }
    } else {
      await deps.displayNotification(deps.registration, "Action not saved", {
        tag: notificationTag,
        body: "Could not save your response. Tap to open the habit.",
        data: { url: habitUrl(data) },
      });
    }
    return;
  }

  const url = habitUrl(data);
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

function habitUrl(data: HabitNotificationData | undefined): string {
  if (data?.habitId) return habitPath(data.habitId);
  return data?.url || "/";
}

function matchWindows(deps: NotificationClickDeps) {
  return deps.clients.matchAll({ type: "window", includeUncontrolled: true });
}
