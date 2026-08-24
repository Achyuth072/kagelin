import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminMetricsPage from "@/../app/admin/metrics/page";

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockGetAdminMetricsSummary = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/admin/metricsQueries", () => ({
  getAdminMetricsSummary: vi.fn((...args: unknown[]) =>
    mockGetAdminMetricsSummary(...args),
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

describe("app/admin/metrics/page auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminMetricsSummary.mockResolvedValue({
      kpis: {
        activeDevicesToday: 10,
        activeDevices7d: 50,
        activeDevices30d: 120,
        pwaRatioPercent: 65,
        totalPwaDevices: 65,
        totalBrowserDevices: 35,
        totalPwaInstalls: 20,
        totalFocusHours: 150.5,
        focusHoursToday: 12.0,
        totalTasksCreated: 300,
        totalTasksCompleted: 240,
        taskCompletionRatePercent: 80,
        timerCompletionRatePercent: 90,
        totalTimerCompleted: 180,
        totalTimerAbandoned: 20,
        totalHabitsLogged: 450,
        totalSignups: 42,
      },
      dailyTrends: [],
      hasData: true,
      generatedAt: "2026-08-20T00:00:00.000Z",
    });
  });

  it("calls notFound() when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(AdminMetricsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockGetAdminMetricsSummary).not.toHaveBeenCalled();
  });

  it("calls notFound() when the user's profile is not admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "regular_user@example.com" } },
    });
    mockSingle.mockResolvedValue({ data: { is_admin: false }, error: null });

    await expect(AdminMetricsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockGetAdminMetricsSummary).not.toHaveBeenCalled();
  });

  it("calls notFound() when the profile lookup errors", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "admin@kagelin.app" } },
    });
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    await expect(AdminMetricsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockGetAdminMetricsSummary).not.toHaveBeenCalled();
  });

  it("renders metrics dashboard when the user's profile is admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "operator@kagelin.app" } },
    });
    mockSingle.mockResolvedValue({ data: { is_admin: true }, error: null });

    const component = await AdminMetricsPage();
    expect(component).toBeDefined();
    expect(mockGetAdminMetricsSummary).toHaveBeenCalledTimes(1);
  });
});
