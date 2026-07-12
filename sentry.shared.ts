// Shared between instrumentation-client.ts, sentry.server.config.ts, and
// sentry.edge.config.ts so the three runtimes stay in sync. Sentry treats a
// falsy dsn as an explicit no-op, so omitting it disables reporting.
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_RELEASE_CHANNEL,
};
