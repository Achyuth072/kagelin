"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface ConnectedCalendarState {
  /** Providers with a live token row (actually connected). */
  providers: string[];
  /** Providers the user opted into whose token was revoked — reconnect needed. */
  needsReconnect: string[];
}

async function fetchConnectedProviders(): Promise<ConnectedCalendarState> {
  const res = await fetch("/api/calendar/connected");
  if (!res.ok) return { providers: [], needsReconnect: [] };
  const data = await res.json();
  return {
    providers: data.providers ?? [],
    needsReconnect: data.needsReconnect ?? [],
  };
}

export function useConnectedCalendarProviders() {
  return useQuery({
    queryKey: ["calendar-connected-providers"],
    queryFn: fetchConnectedProviders,
    staleTime: 30_000,
  });
}

export function useDisconnectCalendarProvider() {
  const queryClient = useQueryClient();

  return async (provider: string) => {
    await fetch(`/api/calendar/disconnect?provider=${provider}`, {
      method: "DELETE",
    });
    queryClient.invalidateQueries({
      queryKey: ["calendar-connected-providers"],
    });
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
  };
}
