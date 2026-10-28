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

const mockExportReport = vi
  .fn()
  .mockResolvedValue("### Mock Diagnostic Report");

vi.mock("@/lib/errors/diagnostics", () => ({
  exportDiagnosticReport: () => mockExportReport(),
}));

describe("DiagnosticExportSettings", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
});
