import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useDiagnosticBundle } from "@/lib/hooks/useDiagnosticBundle";

const mockExportReport = vi.fn().mockResolvedValue("### Report");

vi.mock("@/lib/errors/diagnostics", () => ({
  exportDiagnosticReport: (...args: unknown[]) => mockExportReport(...args),
  getExtendedSystemInfo: vi.fn(),
  getDiagnosticErrors: vi.fn().mockResolvedValue([]),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark" }),
}));

let mockIsGuestMode = false;

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: mockIsGuestMode }),
}));

function renderBundleHook(queryClient: QueryClient) {
  return renderHook(() => useDiagnosticBundle(), {
    wrapper: ({ children }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      ),
  });
}

describe("useDiagnosticBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGuestMode = false;
    mockExportReport.mockReset().mockResolvedValue("### Report");
  });

  it("generates the markdown report with the account tier and pending mutation count", async () => {
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "getMutationCache").mockReturnValue({
      getAll: () => [
        { state: { status: "pending" } },
        { state: { status: "success", isPaused: false } },
        { state: { status: "idle", isPaused: true } },
      ],
    } as never);

    const { result } = renderBundleHook(queryClient);

    await expect(result.current.generateReport()).resolves.toBe("### Report");
    expect(mockExportReport).toHaveBeenCalledWith(undefined, {
      tier: "registered",
      pendingMutationsCount: 2,
    });
  });

  it("reports the guest tier when running without an account", async () => {
    mockIsGuestMode = true;
    const queryClient = new QueryClient();

    const { result } = renderBundleHook(queryClient);

    await result.current.generateReport();
    expect(mockExportReport).toHaveBeenCalledWith(undefined, {
      tier: "guest",
      pendingMutationsCount: 0,
    });
  });
});
