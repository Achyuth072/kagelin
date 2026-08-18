import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useHasPassword } from "@/lib/hooks/useHasPassword";

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: mockRpc }),
}));

const mockAuthValue: { user: { id: string } | null; isGuestMode: boolean } = {
  user: { id: "test-user-123" },
  isGuestMode: false,
};

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => mockAuthValue,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
};

describe("useHasPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthValue.user = { id: "test-user-123" };
    mockAuthValue.isGuestMode = false;
  });

  it("calls the has_password RPC and returns its result", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    const { result } = renderHook(() => useHasPassword(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRpc).toHaveBeenCalledWith("has_password");
    expect(result.current.hasPassword).toBe(true);
  });

  it("does not call the RPC in guest mode", () => {
    mockAuthValue.user = null;
    mockAuthValue.isGuestMode = true;

    renderHook(() => useHasPassword(), { wrapper: createWrapper() });

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("refetchHasPassword re-invokes the RPC", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() => useHasPassword(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRpc).toHaveBeenCalledTimes(1);

    await result.current.refetchHasPassword();

    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
  });
});
