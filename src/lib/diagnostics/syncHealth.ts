import type { QueryClient } from "@tanstack/react-query";

export function getPendingMutationsCount(
  queryClient: QueryClient | undefined | null,
): number {
  if (!queryClient?.getMutationCache) return 0;
  const mutations = queryClient.getMutationCache().getAll();
  return mutations.filter(
    (m) => m.state.status === "pending" || m.state.isPaused,
  ).length;
}
