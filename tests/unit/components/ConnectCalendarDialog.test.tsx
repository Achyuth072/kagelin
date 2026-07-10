import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConnectCalendarDialog } from "@/components/calendar/ConnectCalendarDialog";

vi.mock("@/lib/hooks/useConnectedCalendarProviders", () => ({
  useConnectedCalendarProviders: () => ({
    data: { providers: [], needsReconnect: [] },
  }),
  useDisconnectCalendarProvider: () => vi.fn(),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

describe("ConnectCalendarDialog (C-2)", () => {
  it("does not render any CalDAV-based provider options (iCloud/CalDAV/Fastmail)", () => {
    render(<ConnectCalendarDialog open onOpenChange={() => {}} />);

    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Outlook")).toBeInTheDocument();
    expect(screen.queryByText("iCloud")).not.toBeInTheDocument();
    expect(screen.queryByText("CalDAV")).not.toBeInTheDocument();
    expect(screen.queryByText("Fastmail")).not.toBeInTheDocument();
  });
});
