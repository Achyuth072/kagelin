import { renderHook } from "@testing-library/react";
import { useSubtasks } from "@/lib/hooks/useSubtasks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockStore } from "@/lib/mock/mock-store";
import { AuthProvider } from "@/components/AuthProvider";
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe("useSubtasks hook", () => {
  beforeEach(() => {
    queryClient.clear();
    mockStore.clearData();
    localStorage.setItem("kanso_guest_mode", "true");
  });

  it("should synchronously return subtasks on initial render via initialData in guest mode", () => {
    mockStore.addTask({
      id: "parent-1",
      content: "Parent Task",
      is_completed: false,
    });
    mockStore.addTask({
      id: "sub-1",
      parent_id: "parent-1",
      content: "Subtask 1",
      is_completed: false,
    });

    const { result } = renderHook(() => useSubtasks("parent-1"), { wrapper });

    // Must be synchronously available on the very first render pass (no delay/pending)
    expect(result.current.data).toBeDefined();
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe("sub-1");
    expect(result.current.isLoading).toBe(false);
  });
});
