"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/AuthProvider";

async function fetchConnectedProviders(): Promise<string[]> {
  const res = await fetch("/api/calendar/connected");
  if (!res.ok) return [];
  const data = await res.json();
  return data.providers ?? [];
}

export function useConnectedCalendarProviders() {
  const { isGuestMode } = useAuth();

  return useQuery({
    queryKey: ["calendar-connected-providers"],
    queryFn: fetchConnectedProviders,
    enabled: !isGuestMode,
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
