import { scrubBreadcrumb, scrubEvent } from "@/lib/errors/scrubEvent";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const isLocalhost =
  typeof window !== "undefined" && LOCAL_HOSTS.has(window.location.hostname);

// Falsy DSN disables reporting.
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !isLocalhost,
  environment: process.env.NEXT_PUBLIC_RELEASE_CHANNEL,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
