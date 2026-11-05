import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ConnectCalendarDialog } from "@/components/calendar/ConnectCalendarDialog";

const mockDisconnect = vi.fn();
const mockNotifySuccess = vi.fn();

vi.mock("@/lib/notify", () => ({
  notify: {
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/hooks/useConnectedCalendarProviders", () => ({
  useConnectedCalendarProviders: () => ({
    data: { providers: ["google"] },
    isLoading: false,
  }),
  useDisconnectCalendarProvider: () => mockDisconnect,
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

describe("ConnectCalendarDialog Disconnect Safety & Async Feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires confirmation dialog before disconnecting provider and shows feedback", async () => {
    let resolveDisconnect: () => void;
    const disconnectPromise = new Promise<void>((resolve) => {
      resolveDisconnect = resolve;
    });
    mockDisconnect.mockReturnValue(disconnectPromise);

    render(<ConnectCalendarDialog open={true} onOpenChange={vi.fn()} />);

    const disconnectBtn = screen.getByRole("button", {
      name: /disconnect google/i,
    });
    fireEvent.click(disconnectBtn);

    // Should not have disconnected immediately
    expect(mockDisconnect).not.toHaveBeenCalled();

    // AlertDialog should be displayed
    expect(screen.getByText("Disconnect Google?")).toBeDefined();
    expect(
      screen.getByText(/Your synced events will no longer be refreshed/i),
    ).toBeDefined();

    // Confirm disconnection
    const confirmBtn = screen.getByRole("button", { name: /^disconnect$/i });
    fireEvent.click(confirmBtn);

    expect(mockDisconnect).toHaveBeenCalledWith("google");

    // The disconnect button on the row should be busy / disabled
    expect(disconnectBtn.getAttribute("aria-busy")).toBe("true");
    expect(disconnectBtn).toBeDisabled();

    // Resolve disconnection
    resolveDisconnect!();

    await waitFor(() => {
      expect(mockNotifySuccess).toHaveBeenCalledWith("Google disconnected");
    });
  });
});
