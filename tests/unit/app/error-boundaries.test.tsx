import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import ErrorBoundary from "@/../app/error";
import GlobalError from "@/../app/global-error";

describe("app/error.tsx (H-2)", () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders a fallback UI instead of crashing", () => {
    render(<ErrorBoundary error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls reset() when 'Try again' is clicked", () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalled();
  });

  it("navigates home when 'Go home' is clicked", () => {
    render(<ErrorBoundary error={new Error("boom")} reset={vi.fn()} />);
    fireEvent.click(screen.getByText("Go home"));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("logs the error for diagnostics", () => {
    const err = new Error("boom");
    render(<ErrorBoundary error={err} reset={vi.fn()} />);
    expect(console.error).toHaveBeenCalledWith("Unhandled render error:", err);
  });

  it("copies diagnostic report to clipboard when 'Copy diagnostics' is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ErrorBoundary error={new Error("render crash")} reset={vi.fn()} />);
    const copyBtn = screen.getByRole("button", { name: /copy diagnostics/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    const copiedText = writeText.mock.calls[0][0];
    expect(copiedText).toContain("Kagelin Diagnostic Report");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});

describe("app/global-error.tsx (H-2)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders a dependency-free fallback for root-layout crashes", () => {
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByText("Kagelin failed to load")).toBeInTheDocument();
  });

  it("calls reset() when 'Try again' is clicked", () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalled();
  });

  it("copies diagnostic report to clipboard when 'Copy diagnostics' is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<GlobalError error={new Error("root crash")} reset={vi.fn()} />);
    const copyBtn = screen.getByRole("button", { name: /copy diagnostics/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    const copiedText = writeText.mock.calls[0][0];
    expect(copiedText).toContain("Kagelin Diagnostic Report");
    expect(await screen.findByText("Diagnostics copied")).toBeInTheDocument();
  });
});
