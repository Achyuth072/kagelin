import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiagnosticExportSettings } from "@/components/settings/DiagnosticExportSettings";
import { notify } from "@/lib/notify";

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGenerateBundle = vi.fn().mockResolvedValue({
  app: { version: "1.0.0", releaseChannel: "preview" },
  data: { counts: { tasks: 5 } },
});

vi.mock("@/lib/hooks/useDiagnosticBundle", () => ({
  useDiagnosticBundle: () => ({
    generateBundle: mockGenerateBundle,
  }),
}));

let mockIsGuestMode = false;
let mockPendingMutations: Array<{
  state: { status: string; isPaused?: boolean };
}> = [];

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: mockIsGuestMode }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    getMutationCache: () => ({
      getAll: () => mockPendingMutations,
    }),
  }),
}));

const mockExportReport = vi
  .fn()
  .mockResolvedValue("### Mock Diagnostic Report");
const mockClearErrors = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/errors/diagnostics", () => ({
  exportDiagnosticReport: (...args: unknown[]) => mockExportReport(...args),
  clearDiagnosticErrors: (...args: unknown[]) => mockClearErrors(...args),
}));

describe("DiagnosticExportSettings", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGuestMode = false;
    mockPendingMutations = [];
    mockExportReport
      .mockReset()
      .mockResolvedValue("### Mock Diagnostic Report");
    mockClearErrors.mockReset().mockResolvedValue(undefined);
    mockGenerateBundle.mockReset().mockResolvedValue({
      app: { version: "1.0.0", releaseChannel: "preview" },
      data: { counts: { tasks: 5 } },
    });
    writeText.mockReset().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });
  });

  it("renders the unified Report a Problem card with Open Report button and consolidated copy", () => {
    render(<DiagnosticExportSettings />);

    expect(screen.getByText("Report a Problem")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open report/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Inspect and export system diagnostics or crash logs for bug reports\. Personal content \(tasks, habits, notes\) is never included\./i,
      ),
    ).toBeInTheDocument();
  });

  it("opens the dialog, displays scrubbed report, and copies to clipboard", async () => {
    render(<DiagnosticExportSettings />);

    const openBtn = screen.getByRole("button", { name: /open report/i });
    await act(async () => {
      fireEvent.click(openBtn);
    });

    // Verify dialog contents
    expect(screen.getByText("Diagnostic Report")).toBeInTheDocument();
    expect(
      screen.getByText(/safe for public bug reports on github/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("### Mock Diagnostic Report"),
    ).toBeInTheDocument();

    // Copy to clipboard
    const copyBtn = screen.getByRole("button", { name: /copy for github/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeText).toHaveBeenCalledWith("### Mock Diagnostic Report");
    expect(notify.success).toHaveBeenCalledWith("Diagnostic report copied");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("toggles advanced data structure, shows privacy warning, and offers bundle download", async () => {
    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    const toggle = screen.getByLabelText(
      /include database schedule structure/i,
    );
    expect(toggle).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(toggle);
    });

    // Should generate bundle and display warning
    expect(mockGenerateBundle).toHaveBeenCalled();
    expect(
      await screen.findByText(
        /structural metadata includes your routine timestamps/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download json/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy full bundle/i }),
    ).toBeInTheDocument();
  });

  it("handles clipboard failure gracefully", async () => {
    writeText.mockRejectedValueOnce(new Error("Permission denied"));

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy for github/i }));
    });

    expect(notify.error).toHaveBeenCalledWith("Couldn't copy to clipboard");
  });

  it("closes the dialog when clicking Close button", async () => {
    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    expect(screen.getByText("Diagnostic Report")).toBeInTheDocument();

    const closeBtn = screen.getAllByRole("button", { name: /close/i })[0];
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    await vi.waitFor(() => {
      expect(screen.queryByText("Diagnostic Report")).not.toBeInTheDocument();
    });
  });

  it("re-fetches diagnostic report every time the dialog is opened", async () => {
    mockExportReport
      .mockResolvedValueOnce("### Initial Report")
      .mockResolvedValueOnce("### Fresh Second Report");

    render(<DiagnosticExportSettings />);

    const openBtn = screen.getByRole("button", { name: /open report/i });

    // Open first time
    await act(async () => {
      fireEvent.click(openBtn);
    });
    expect(await screen.findByText("### Initial Report")).toBeInTheDocument();
    expect(mockExportReport).toHaveBeenCalledTimes(1);

    // Close dialog
    const closeBtn = screen.getAllByRole("button", { name: /close/i })[0];
    await act(async () => {
      fireEvent.click(closeBtn);
    });
    await vi.waitFor(() => {
      expect(screen.queryByText("Diagnostic Report")).not.toBeInTheDocument();
    });

    // Re-open dialog - should fetch fresh report instead of serving stale report
    await act(async () => {
      fireEvent.click(openBtn);
    });
    expect(
      await screen.findByText("### Fresh Second Report"),
    ).toBeInTheDocument();
    expect(mockExportReport).toHaveBeenCalledTimes(2);
  });

  it("displays captured timestamp in header and refreshes report on Refresh click", async () => {
    mockExportReport
      .mockResolvedValueOnce("### Initial Report")
      .mockResolvedValueOnce("### Refreshed Report");

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    expect(await screen.findByText("### Initial Report")).toBeInTheDocument();
    expect(screen.getByText(/captured at/i)).toBeInTheDocument();

    const refreshBtn = screen.getByRole("button", { name: /refresh/i });
    expect(refreshBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(await screen.findByText("### Refreshed Report")).toBeInTheDocument();
    expect(mockExportReport).toHaveBeenCalledTimes(2);
  });

  it("keeps preview mounted without aggressive loading flash when refreshing", async () => {
    let resolveRefresh: (value: string) => void = () => {};
    const refreshPromise = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });

    mockExportReport
      .mockResolvedValueOnce("### Initial Report")
      .mockReturnValueOnce(refreshPromise);

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    expect(await screen.findByText("### Initial Report")).toBeInTheDocument();

    const refreshBtn = screen.getByRole("button", { name: /refresh/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    // While refresh is pending:
    // Existing preview stays in document (no aggressive flash / unmounting)
    expect(screen.getByText("### Initial Report")).toBeInTheDocument();
    expect(screen.queryByText("Loading diagnostics…")).not.toBeInTheDocument();
    const pre = screen.getByText("### Initial Report");
    expect(pre).toHaveAttribute("aria-busy", "true");

    // Resolve the refresh
    await act(async () => {
      resolveRefresh("### Fresh After Refresh");
    });

    expect(
      await screen.findByText("### Fresh After Refresh"),
    ).toBeInTheDocument();
    expect(pre).toHaveAttribute("aria-busy", "false");
  });

  it("prompts confirmation and clears diagnostic errors upon confirmation", async () => {
    mockExportReport
      .mockResolvedValueOnce("### Initial Report with 1 error")
      .mockResolvedValueOnce(
        "### Diagnostic Report\n\n*No diagnostic errors recorded.*",
      );

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    expect(
      await screen.findByText("### Initial Report with 1 error"),
    ).toBeInTheDocument();

    // Click Clear Log to show confirmation prompt
    const clearBtn = screen.getByRole("button", { name: /clear log/i });
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    expect(screen.getByText("Clear errors?")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /confirm/i });
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(confirmBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();

    // Confirm clear
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockClearErrors).toHaveBeenCalledTimes(1);
    expect(notify.success).toHaveBeenCalledWith("Diagnostic errors cleared");
    expect(
      await screen.findByText(/no diagnostic errors recorded/i),
    ).toBeInTheDocument();
  });

  it("cancels clear log confirmation without calling clearDiagnosticErrors", async () => {
    mockExportReport.mockResolvedValueOnce("### Initial Report");

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    expect(await screen.findByText("### Initial Report")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /clear log/i }));
    });

    expect(screen.getByText("Clear errors?")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    expect(mockClearErrors).not.toHaveBeenCalled();
    expect(screen.queryByText("Clear errors?")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /clear log/i }),
    ).toBeInTheDocument();
  });

  it("resets active data bundle when clearing errors so the markdown report preview is shown", async () => {
    mockExportReport
      .mockResolvedValueOnce("### Initial Report")
      .mockResolvedValueOnce(
        "### Diagnostic Report\n\n*No diagnostic errors recorded.*",
      );

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    // Enable bundle
    const toggle = screen.getByLabelText(
      /include database schedule structure/i,
    );
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(mockGenerateBundle).toHaveBeenCalledTimes(1);

    // Now clear errors
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /clear log/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    });

    expect(mockClearErrors).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/no diagnostic errors recorded/i),
    ).toBeInTheDocument();
    // Toggle should be unchecked
    expect(toggle).not.toBeChecked();
  });

  it("notifies error when diagnostic report fails to load", async () => {
    mockExportReport.mockRejectedValueOnce(new Error("Failed to export"));

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    expect(notify.error).toHaveBeenCalledWith(
      "Couldn't generate diagnostic report",
    );
  });

  it("notifies error when clearing diagnostic errors fails", async () => {
    mockExportReport.mockResolvedValueOnce("### Initial Report");
    mockClearErrors.mockRejectedValueOnce(new Error("Disk error"));

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /clear log/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    });

    expect(notify.error).toHaveBeenCalledWith(
      "Couldn't clear diagnostic errors",
    );
  });

  it("refreshes active data bundle when refresh is clicked with advanced data structure enabled", async () => {
    mockExportReport
      .mockResolvedValueOnce("### Initial Report")
      .mockResolvedValueOnce("### Refreshed Report");

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    // Toggle advanced bundle
    const toggle = screen.getByLabelText(
      /include database schedule structure/i,
    );
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(mockGenerateBundle).toHaveBeenCalledTimes(1);

    // Refresh
    const refreshBtn = screen.getByRole("button", { name: /refresh/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(mockExportReport).toHaveBeenCalledTimes(2);
    expect(mockGenerateBundle).toHaveBeenCalledTimes(2);
  });

  it("notifies error when refreshing active data bundle fails", async () => {
    mockExportReport
      .mockResolvedValueOnce("### Initial Report")
      .mockResolvedValueOnce("### Refreshed Report");
    mockGenerateBundle
      .mockResolvedValueOnce({
        app: { version: "1.0.0", releaseChannel: "preview" },
        data: { counts: { tasks: 5 } },
      })
      .mockRejectedValueOnce(new Error("Bundle build failed"));

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    const toggle = screen.getByLabelText(
      /include database schedule structure/i,
    );
    await act(async () => {
      fireEvent.click(toggle);
    });

    const refreshBtn = screen.getByRole("button", { name: /refresh/i });
    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(notify.error).toHaveBeenCalledWith("Couldn't refresh state bundle");
  });

  it("passes registered tier and pending mutations count to exportDiagnosticReport", async () => {
    mockIsGuestMode = false;
    mockPendingMutations = [
      { state: { status: "pending" } },
      { state: { status: "success", isPaused: false } },
      { state: { status: "idle", isPaused: true } },
    ];

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    expect(mockExportReport).toHaveBeenCalledWith(undefined, {
      tier: "registered",
      pendingMutationsCount: 2,
    });
  });

  it("passes guest tier to exportDiagnosticReport when in guest mode", async () => {
    mockIsGuestMode = true;
    mockPendingMutations = [];

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    expect(mockExportReport).toHaveBeenCalledWith(undefined, {
      tier: "guest",
      pendingMutationsCount: 0,
    });
  });

  it("renders storage and service worker lines in the markdown preview", async () => {
    mockExportReport.mockResolvedValueOnce(
      [
        "### Kagelin Diagnostic Report",
        "#### System Information",
        "- **Tier:** `registered`",
        "- **Storage:** `14.2 MB / 2048 MB (0.7% used, persistent)`",
        "- **Service Worker:** `active (activated)`",
        "- **Pending Offline Mutations:** `0`",
      ].join("\n"),
    );

    render(<DiagnosticExportSettings />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /open report/i }));
    });

    expect(
      await screen.findByText(
        "- **Storage:** `14.2 MB / 2048 MB (0.7% used, persistent)`",
        { exact: false },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("- **Service Worker:** `active (activated)`", {
        exact: false,
      }),
    ).toBeInTheDocument();
  });
});
