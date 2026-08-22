import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useClearGuestData,
  useResetDemoData,
} from "@/lib/hooks/useGuestStoreActions";
import { useDemoMode } from "@/lib/hooks/useDemoMode";
import { AuthProvider } from "@/components/AuthProvider";
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

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe("useClearGuestData", () => {
  beforeEach(() => {
    queryClient.clear();
    localStorage.clear();
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.reset();
  });

  it("wipes the guest store and takes Demo mode with it", async () => {
    const { result: demoMode } = renderHook(() => useDemoMode(), { wrapper });
    await waitFor(() => expect(demoMode.current).toBe(true));

    const { result: clearGuestData } = renderHook(() => useClearGuestData(), {
      wrapper,
    });

    act(() => clearGuestData.current());

    expect(mockStore.getTasks()).toEqual([]);
    await waitFor(() => expect(demoMode.current).toBe(false));
  });
});

// Reset Demo repopulates seed data, so Demo mode goes from off back to on —
// the bar showing "Start fresh" again must reflect that, not a stale cache.
describe("useResetDemoData", () => {
  beforeEach(() => {
    queryClient.clear();
    localStorage.clear();
    localStorage.setItem("kanso_guest_mode", "true");
    mockStore.clearData();
  });

  it("brings Demo mode back after it was cleared", async () => {
    const { result: demoMode } = renderHook(() => useDemoMode(), { wrapper });
    await waitFor(() => expect(demoMode.current).toBe(false));

    const { result: resetDemoData } = renderHook(() => useResetDemoData(), {
      wrapper,
    });

    act(() => resetDemoData.current());

    expect(mockStore.getTasks().length).toBeGreaterThan(0);
    await waitFor(() => expect(demoMode.current).toBe(true));
  });
});
