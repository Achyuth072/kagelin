"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

async function fetchConnectedProviders(): Promise<string[]> {
  const res = await fetch("/api/calendar/connected");
  if (!res.ok) return [];
  const data = await res.json();
  return data.providers ?? [];
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
    await fetch(`/api/calendar/disconnect?provider=${provider}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["calendar-connected-providers"] });
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
  };
}
