import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/components/AuthProvider";
import { useDemoMode } from "@/lib/hooks/useDemoMode";
import { mockStore } from "@/lib/mock/mock-store";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  })),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe("useDemoMode", () => {
  beforeEach(() => {
    queryClient.clear();
    localStorage.clear();
    mockStore.clearData();
  });

  it("is false outside guest mode, even with seed ids present", async () => {
    const { result } = renderHook(() => useDemoMode(), { wrapper });

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("is true for a guest whose store still holds a Demo item", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.reset();

    const { result } = renderHook(() => useDemoMode(), { wrapper });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("is false once the guest's store has no Demo item left", async () => {
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.clearData();

    const { result } = renderHook(() => useDemoMode(), { wrapper });

    await waitFor(() => expect(result.current).toBe(false));
  });
});
