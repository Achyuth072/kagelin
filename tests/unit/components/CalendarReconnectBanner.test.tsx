import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalendarReconnectBanner } from "@/components/calendar/CalendarReconnectBanner";

const h = vi.hoisted(() => ({
  needsReconnect: [] as string[],
}));

vi.mock("@/lib/hooks/useConnectedCalendarProviders", () => ({
  useConnectedCalendarProviders: () => ({
    data: { providers: [], needsReconnect: h.needsReconnect },
  }),
}));

describe("CalendarReconnectBanner (#57)", () => {
  beforeEach(() => {
    h.needsReconnect = [];
  });

  it("renders nothing when no provider needs reconnecting", () => {
    const { container } = render(<CalendarReconnectBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a persistent reconnect prompt for a revoked provider", () => {
    h.needsReconnect = ["google"];
    render(<CalendarReconnectBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Google Calendar/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reconnect/i }),
    ).toBeInTheDocument();
  });

  it("renders one prompt per revoked provider", () => {
    h.needsReconnect = ["google", "outlook"];
    render(<CalendarReconnectBanner />);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
});
