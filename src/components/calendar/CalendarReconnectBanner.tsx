"use client";

import { RefreshCw } from "lucide-react";
import { DestructiveAlertBanner } from "@/components/ui/destructive-alert-banner";
import { useConnectedCalendarProviders } from "@/lib/hooks/useConnectedCalendarProviders";
import { capitalize } from "@/lib/utils";

// Auto-sync silently swallows token revocation, requiring a persistent banner rather than a toast.
export function CalendarReconnectBanner() {
  const { data } = useConnectedCalendarProviders();
  const needsReconnect = data?.needsReconnect ?? [];

  if (needsReconnect.length === 0) return null;

  return (
    <>
      {needsReconnect.map((provider) => {
        const name = capitalize(provider);
        return (
          <DestructiveAlertBanner
            key={provider}
            message={
              <>
                <span className="font-medium">{name} Calendar</span> needs
                reconnecting — sync is paused until you sign in again.
              </>
            }
            actionLabel="Reconnect"
            actionIcon={RefreshCw}
            onAction={() => {
              window.location.href = `/api/calendar/connect/${provider}`;
            }}
          />
        );
      })}
    </>
  );
}
