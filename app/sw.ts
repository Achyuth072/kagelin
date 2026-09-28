import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  NetworkFirst,
  ExpirationPlugin,
  type RuntimeCaching,
  type SerwistPlugin,
} from "serwist";
import {
  displayNotification,
  type EncryptedNotificationBody,
  type NotificationDisplayOptions,
} from "@/lib/notifications";
import {
  handleNotificationClick,
  type HabitNotificationData,
} from "@/lib/sw/notificationClickHandler";
import { hasWasmMagicBytes } from "@/lib/sw/wasmIntegrity";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

interface StrategyWithCacheName {
  cacheName: string;
  plugins?: SerwistPlugin[];
}

// Without a timeout, navigation waits the full TCP timeout (~3.3 min) before falling back to cache.
const patchedCache = defaultCache.map((entry) => {
  const handler = entry.handler;
  if (handler && typeof handler !== "function" && "cacheName" in handler) {
    const strategy = handler as unknown as StrategyWithCacheName;
    if (
      strategy.cacheName === PAGES_CACHE_NAME.html ||
      strategy.cacheName === PAGES_CACHE_NAME.rsc ||
      strategy.cacheName === PAGES_CACHE_NAME.rscPrefetch ||
      strategy.cacheName === "others"
    ) {
      return {
        ...entry,
        handler: new NetworkFirst({
          cacheName: strategy.cacheName,
          plugins: strategy.plugins,
          networkTimeoutSeconds: 3,
        }),
      };
    }
  }
  return entry;
});

const OFFLINE_URL = "/offline.html";
const NAVIGATION_CACHE = PAGES_CACHE_NAME.html;

const usableForNavigation: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) =>
    response.status === 200 && !response.redirected ? response : null,
};

const navigationRoute: RuntimeCaching = {
  matcher: ({ request }) => request.mode === "navigate",
  handler: new NetworkFirst({
    cacheName: NAVIGATION_CACHE,
    networkTimeoutSeconds: 3,
    plugins: [usableForNavigation, new ExpirationPlugin({ maxEntries: 64 })],
  }),
};

// Rejects a bad response before it reaches the runtime cache (e.g. an HTML
// error page served in place of the binary) rather than relying on the next
// fetch to overwrite it.
const wasmIntegrityPlugin: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) => {
    if (response.status !== 200) return null;
    const bytes = await response.clone().arrayBuffer();
    return hasWasmMagicBytes(bytes) ? response : null;
  },
};

const wasmRoute: RuntimeCaching = {
  matcher: ({ url }) => url.pathname === "/sql-wasm.wasm",
  handler: new NetworkFirst({
    cacheName: "sql-wasm",
    networkTimeoutSeconds: 10,
    plugins: [wasmIntegrityPlugin],
  }),
};

const finalCache: RuntimeCaching[] = [
  navigationRoute,
  wasmRoute,
  ...patchedCache.filter((e) => {
    const isCatchAll =
      e.matcher instanceof RegExp &&
      e.matcher.source === ".*" &&
      e.matcher.flags.includes("i");
    return !isCatchAll;
  }),
  {
    matcher: /.*/i,
    method: "GET",
    handler: new NetworkFirst({
      cacheName: "others",
      networkTimeoutSeconds: 10,
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: finalCache,
  fallbacks: {
    entries: [
      {
        url: OFFLINE_URL,
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.setCatchHandler(async ({ request }) => {
  if (request.destination === "document") {
    const cached = await serwist.matchPrecache(OFFLINE_URL);
    if (cached) return cached;
  }
  return Response.error();
});

serwist.addEventListeners();

interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: HabitNotificationData & Record<string, unknown>;
  actions?: NotificationDisplayOptions["actions"];
  encrypted?: EncryptedNotificationBody;
  encryptedTitle?: EncryptedNotificationBody;
}

const FALLBACK_TITLE = "Kagelin";
const FALLBACK_BODY = "You have a new notification";

function readPushText(data: PushMessageData): string | undefined {
  try {
    return data.text() || undefined;
  } catch (err) {
    console.warn("[SW] Push payload is not text either", err);
    return undefined;
  }
}

// iOS revokes the push subscription if a push displays nothing.
function readPushPayload(data: PushMessageData | null): PushPayload {
  if (!data) return {};
  try {
    return (data.json() ?? {}) as PushPayload;
  } catch (err) {
    console.warn("[SW] Push payload is not JSON, falling back to text", err);
    return { body: readPushText(data) };
  }
}

async function showPushNotification(payload: PushPayload): Promise<void> {
  const options: NotificationDisplayOptions = {
    body: payload.body || FALLBACK_BODY,
  };

  if (payload.icon) options.icon = payload.icon;
  if (payload.badge) options.badge = payload.badge;
  if (payload.tag) {
    options.tag = payload.tag;
    options.renotify = true;
  }
  if (payload.data) options.data = payload.data;
  if (payload.actions) options.actions = payload.actions;
  if (payload.encrypted?.ciphertext && payload.encrypted?.template) {
    options.encrypted = payload.encrypted;
  }
  if (payload.encryptedTitle?.ciphertext && payload.encryptedTitle?.template) {
    options.encryptedTitle = payload.encryptedTitle;
  }
  if (payload.data?.habitKind) {
    options.habitKind = payload.data.habitKind;
  }

  try {
    await displayNotification(
      self.registration,
      payload.title || FALLBACK_TITLE,
      options,
    );
  } catch (err) {
    console.error("[SW] Failed to show notification; showing fallback", err);
    await displayNotification(self.registration, FALLBACK_TITLE, {
      body: FALLBACK_BODY,
    });
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(showPushNotification(readPushPayload(event.data ?? null)));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data as HabitNotificationData | undefined;
  const action = event.action;

  event.waitUntil(
    handleNotificationClick(action, data, event.notification.tag || undefined, {
      fetch,
      clients: self.clients,
      displayNotification,
      registration: self.registration,
      openWindow: (url: string) => {
        const openUrl =
          url !== "/" && url.startsWith("/")
            ? `/?redirect=${encodeURIComponent(url)}`
            : url;
        return self.clients.openWindow?.(openUrl);
      },
    }),
  );
});

// Chrome Android auto-rotates push subscriptions.
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] Push subscription change detected");

  event.waitUntil(
    (async () => {
      try {
        const existingSubscription =
          await self.registration.pushManager.getSubscription();
        if (existingSubscription) {
          console.log("[SW] Unsubscribing from old push subscription");
          await existingSubscription.unsubscribe();
        }

        // NEXT_PUBLIC_ vars are replaced at build time, so process.env is a literal here.
        const vapidKey =
          typeof process !== "undefined" &&
          process.env?.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            : "";
        if (!vapidKey) {
          console.warn(
            "[SW] VAPID public key not available, cannot re-subscribe to push",
          );
          return;
        }

        const newSubscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });

        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: newSubscription }),
        });

        if (!response.ok) {
          console.error(
            "[SW] Failed to sync new subscription:",
            await response.text(),
          );
          return;
        }

        console.log("[SW] Push subscription re-synced successfully");
      } catch (err) {
        console.error("[SW] Failed to re-sync push subscription:", err);
        throw err;
      }
    })(),
  );
});

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
