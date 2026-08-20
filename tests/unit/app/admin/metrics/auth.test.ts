import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminMetricsPage from "@/../app/admin/metrics/page";

const mockGetUser = vi.fn();
const mockGetAdminMetricsSummary = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
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
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
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

  afterEach(() => {
    process.env = originalEnv;
  });

  it("calls notFound() when user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    process.env.ADMIN_EMAILS = "operator@kagelin.app";

    await expect(AdminMetricsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockGetAdminMetricsSummary).not.toHaveBeenCalled();
  });

  it("calls notFound() when user email is not in ADMIN_EMAILS", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "regular_user@example.com" } },
    });
    process.env.ADMIN_EMAILS = "admin1@kagelin.app, admin2@kagelin.app";

    await expect(AdminMetricsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockGetAdminMetricsSummary).not.toHaveBeenCalled();
  });

  it("calls notFound() when ADMIN_EMAILS is undefined or empty", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "admin@kagelin.app" } },
    });
    delete process.env.ADMIN_EMAILS;

    await expect(AdminMetricsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mockGetAdminMetricsSummary).not.toHaveBeenCalled();
  });

  it("renders metrics dashboard when user email matches ADMIN_EMAILS", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "operator@kagelin.app" } },
    });
    process.env.ADMIN_EMAILS = "other@kagelin.app, operator@kagelin.app";

    const component = await AdminMetricsPage();
    expect(component).toBeDefined();
    expect(mockGetAdminMetricsSummary).toHaveBeenCalledTimes(1);
  });

  it("handles case-insensitivity and leading/trailing whitespace in ADMIN_EMAILS", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "Operator@Kagelin.APP" } },
    });
    process.env.ADMIN_EMAILS = "  operator@kagelin.app , test@kagelin.app  ";

    const component = await AdminMetricsPage();
    expect(component).toBeDefined();
    expect(mockGetAdminMetricsSummary).toHaveBeenCalledTimes(1);
  });
});
