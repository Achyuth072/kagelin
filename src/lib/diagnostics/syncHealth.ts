import type { QueryClient } from "@tanstack/react-query";

export function getPendingMutationsCount(
  queryClient: QueryClient | undefined | null,
): number {
  if (!queryClient?.getMutationCache) return 0;
  try {
    const mutations = queryClient.getMutationCache().getAll();
    return mutations.filter(
      (m) => m.state.status === "pending" || m.state.isPaused,
    ).length;
  } catch {
    return 0;
  }
}
