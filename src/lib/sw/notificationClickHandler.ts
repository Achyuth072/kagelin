import type { NotificationDisplayOptions } from "@/lib/notifications";

export interface HabitNotificationData {
  habitId?: string;
  date?: string;
  habitKind?: "boolean" | "measurable";
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
    const ok = await deps
      .fetch("/api/habits/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitId: data.habitId, date: data.date, state }),
      })
      .then(
        (res) => res.ok,
        () => false,
      );

    if (ok) {
      for (const client of await matchWindows(deps)) {
        client.postMessage({ type: "HABIT_ENTRY_UPDATED" });
      }
    } else {
      await deps.displayNotification(deps.registration, "Action not saved", {
        tag: notificationTag,
        body: "Could not save your response. Tap to open the habit.",
        data: { url: data.url ?? "/habits" },
      });
    }
    return;
  }

  // Body tap (action === "") or unknown — navigate to the habit URL.
  const url = data?.url ?? "/habits";
  for (const client of await matchWindows(deps)) {
    if (!("focus" in client)) continue;
    const alreadyThere = new URL(client.url).pathname === url;
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

  deps.openWindow(url);
}

function matchWindows(deps: NotificationClickDeps) {
  return deps.clients.matchAll({ type: "window", includeUncontrolled: true });
}
