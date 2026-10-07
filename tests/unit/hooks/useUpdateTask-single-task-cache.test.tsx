import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useUpdateTask } from "@/lib/hooks/useTaskMutations";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ isGuestMode: false, user: { id: "test-user" } })),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/telemetry/client", () => ({ trackTelemetry: vi.fn() }));

vi.mock("@/lib/mutations/task", () => ({
  taskMutations: {
    update: vi.fn().mockResolvedValue({ id: "task-1", content: "Edited" }),
  },
}));

vi.mock("@/lib/utils/mutation-error", () => ({
  handleMutationError: vi.fn(),
}));

describe("useUpdateTask single-task caches", () => {
  it("marks the ['task', id] cache stale so calendar and focus views refetch after an edit", async () => {
    const queryClient = new QueryClient();
    const singleKey = ["task", "task-1", false];
    queryClient.setQueryData(singleKey, { id: "task-1", content: "Old" });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateTask(), { wrapper });

    await act(async () => {
      result.current.mutate({ id: "task-1", content: "Edited" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryState(singleKey)?.isInvalidated).toBe(true);
  });
});
