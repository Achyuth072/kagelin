"use client";

import { TriangleAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectedCalendarProviders } from "@/lib/hooks/useConnectedCalendarProviders";

/**
 * Persistent "reconnect needed" banner (#57).
 *
 * Refresh tokens get revoked out from under us — Google auto-expires them after
 * 7 days while the OAuth app is in "Testing", and any provider revocation lands
 * the same way. The failure is otherwise silent (the mount/refocus auto-sync
 * swallows its errors), so surface a persistent, actionable prompt instead of a
 * transient toast. Reconnecting re-runs the OAuth consent and re-mints a token.
 */
export function CalendarReconnectBanner() {
  const { data } = useConnectedCalendarProviders();
  const needsReconnect = data?.needsReconnect ?? [];

  if (needsReconnect.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
      {needsReconnect.map((provider) => {
        const name = provider.charAt(0).toUpperCase() + provider.slice(1);
        return (
          <div
            key={provider}
            role="alert"
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <TriangleAlert
                className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500"
                strokeWidth={2.25}
              />
              <p className="text-sm text-amber-800 dark:text-amber-200 truncate">
                <span className="font-medium">{name} Calendar</span> needs
                reconnecting — sync is paused until you sign in again.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1.5 border-amber-500/40 bg-transparent text-amber-800 hover:bg-amber-500/15 dark:text-amber-100"
              onClick={() => {
                window.location.href = `/api/calendar/connect/${provider}`;
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} />
              Reconnect
            </Button>
          </div>
        );
      })}
    </div>
  );
}
