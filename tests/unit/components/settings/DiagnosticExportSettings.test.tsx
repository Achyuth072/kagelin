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

vi.mock("@/lib/hooks/useDiagnosticBundle", () => ({
  useDiagnosticBundle: () => ({
    generateBundle: vi.fn().mockResolvedValue({
      app: { version: "1.0.0", releaseChannel: "preview" },
    }),
  }),
}));

vi.mock("@/lib/errors/diagnostics", () => ({
  exportDiagnosticReport: vi
    .fn()
    .mockResolvedValue("### Mock Diagnostic Report"),
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

  it("renders both bundle generation and diagnostic error log sections", () => {
    render(<DiagnosticExportSettings />);

    expect(screen.getByText("Report a Problem")).toBeInTheDocument();
    expect(screen.getByText("Diagnostic Error Log")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy log/i }),
    ).toBeInTheDocument();
  });

  it("copies diagnostic log to clipboard and shows feedback", async () => {
    render(<DiagnosticExportSettings />);

    const copyLogBtn = screen.getByRole("button", { name: /copy log/i });
    await act(async () => {
      fireEvent.click(copyLogBtn);
    });

    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith("### Mock Diagnostic Report");
    expect(notify.success).toHaveBeenCalledWith("Diagnostic log copied");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("notifies error if copying diagnostic log fails", async () => {
    writeText.mockRejectedValueOnce(new Error("Permission denied"));

    render(<DiagnosticExportSettings />);

    const copyLogBtn = screen.getByRole("button", { name: /copy log/i });
    await act(async () => {
      fireEvent.click(copyLogBtn);
    });

    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith("Couldn't copy diagnostic log"),
    );
  });
});
