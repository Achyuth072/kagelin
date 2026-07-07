import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectCalendarDialog } from "@/components/calendar/ConnectCalendarDialog";

const CALDAV_STORAGE_KEY = "kanso_caldav_credentials";

vi.mock("@/lib/hooks/useConnectedCalendarProviders", () => ({
  useConnectedCalendarProviders: () => ({ data: [] }),
  useDisconnectCalendarProvider: () => vi.fn(),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/lib/caldav/client", () => ({
  discoverCalendars: vi.fn(),
}));

describe("ConnectCalendarDialog (C-2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not render any CalDAV-based provider options (iCloud/CalDAV/Fastmail)", () => {
    render(<ConnectCalendarDialog open onOpenChange={() => {}} />);

    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("Outlook")).toBeInTheDocument();
    expect(screen.queryByText("iCloud")).not.toBeInTheDocument();
    expect(screen.queryByText("CalDAV")).not.toBeInTheDocument();
    expect(screen.queryByText("Fastmail")).not.toBeInTheDocument();
  });

  it("purges any legacy plaintext CalDAV credentials left in localStorage", () => {
    localStorage.setItem(
      CALDAV_STORAGE_KEY,
      JSON.stringify({
        server_url: "https://dav.example.com",
        username: "user",
        password: "super-secret",
      }),
    );

    render(<ConnectCalendarDialog open onOpenChange={() => {}} />);

    expect(localStorage.getItem(CALDAV_STORAGE_KEY)).toBeNull();
  });
});
