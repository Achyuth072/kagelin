import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { HabitCard } from "@/components/habits/HabitCard";
import { ENTRY_VALUE_SKIPPED, type HabitWithEntries } from "@/lib/types/habit";
import * as useIsMobileModule from "@/lib/hooks/useIsMobile";
import * as useHabitMutationsModule from "@/lib/hooks/useHabitMutations";

vi.mock("@/lib/hooks/useIsMobile");
vi.mock("@/lib/hooks/useHabitMutations");

describe("HabitCard Scroll Initialization", () => {
  let mockHabit: HabitWithEntries;

  beforeEach(() => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
    vi.mocked(useHabitMutationsModule.useMarkHabitComplete).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<
      typeof useHabitMutationsModule.useMarkHabitComplete
    >);

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 365);

    mockHabit = {
      id: "habit-test",
      user_id: "user-test",
      name: "Test Habit",
      description: "Test description",
      color: "#3b82f6",
      icon: "Droplets",
      created_at: today.toISOString(),
      updated_at: today.toISOString(),
      archived_at: null,
      start_date: startDate.toISOString().split("T")[0],
      sort_order: 0,
      entries: [],
    };
  });

  it("should use scrollbar-hide on desktop for premium look", async () => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
    const { container } = render(<HabitCard habit={mockHabit} />);

    const scrollContainer = container.querySelector(
      ".overflow-x-auto",
    ) as HTMLElement;
    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer.className).toContain("scrollbar-hide");
    expect(scrollContainer.className).not.toContain("custom-scrollbar");
  });

  it("should use scrollbar-hide on mobile for clean UI", async () => {
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(true);
    const { container } = render(<HabitCard habit={mockHabit} />);

    const scrollContainer = container.querySelector(
      ".overflow-x-auto",
    ) as HTMLElement;
    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer.className).toContain("scrollbar-hide");
    expect(scrollContainer.className).not.toContain("custom-scrollbar");
  });

  it("keeps the year heatmap as its read-only glance", () => {
    const { container } = render(<HabitCard habit={mockHabit} />);
    expect(container.querySelector("rect[data-date]")).toBeTruthy();
  });
});

describe("HabitCard today button", () => {
  const mutate = vi.fn();
  const today = new Date().toISOString().split("T")[0];
  const base: HabitWithEntries = {
    id: "habit-test",
    user_id: "user-test",
    name: "Read a book",
    description: null,
    color: "#3b82f6",
    icon: "Book",
    created_at: today,
    updated_at: today,
    archived_at: null,
    start_date: today,
    sort_order: 0,
    entries: [],
  };
  const measurable: HabitWithEntries = {
    ...base,
    habit_type: "measurable",
    target_type: "at_least",
    target_value: 10,
    unit: "pages",
  };
  const entry = (value: number) => ({
    id: "e1",
    habit_id: base.id,
    date: today,
    value,
    created_at: today,
  });

  beforeEach(() => {
    mutate.mockReset();
    vi.mocked(useIsMobileModule.useIsMobile).mockReturnValue(false);
    vi.mocked(useHabitMutationsModule.useMarkHabitComplete).mockReturnValue({
      mutate,
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<
      typeof useHabitMutationsModule.useMarkHabitComplete
    >);
  });

  it("still toggles a Boolean Habit with the done value", () => {
    render(<HabitCard habit={base} />);
    fireEvent.click(
      screen.getByRole("button", { name: /^Today, .*not logged$/ }),
    );
    expect(mutate).toHaveBeenCalledWith({
      habitId: base.id,
      date: today,
      value: 1,
    });
  });

  it("cycles a Boolean Habit's done today to skipped, then clears it", () => {
    const { rerender } = render(
      <HabitCard habit={{ ...base, entries: [entry(1)] }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Today, .*done$/ }));
    expect(mutate).toHaveBeenLastCalledWith({
      habitId: base.id,
      date: today,
      value: ENTRY_VALUE_SKIPPED,
    });

    rerender(
      <HabitCard habit={{ ...base, entries: [entry(ENTRY_VALUE_SKIPPED)] }} />,
    );
    const button = screen.getByRole("button", { name: /^Today, .*skipped$/ });
    expect(button.querySelector(".lucide-pause")).not.toBeNull();
    fireEvent.click(button);
    expect(mutate).toHaveBeenLastCalledWith({
      habitId: base.id,
      date: today,
      value: null,
    });
  });

  it("skips a Measurable Habit's today from the popover", () => {
    render(<HabitCard habit={measurable} />);
    fireEvent.click(screen.getByRole("button", { name: /log amount/i }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(mutate).toHaveBeenCalledWith({
      habitId: base.id,
      date: today,
      value: ENTRY_VALUE_SKIPPED,
    });
  });

  it("asks a Measurable Habit for a quantity instead of writing one", () => {
    render(<HabitCard habit={measurable} />);
    fireEvent.click(screen.getByRole("button", { name: /log amount/i }));
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Log amount"), {
      target: { value: "8" },
    });
    fireEvent.click(screen.getByText("Log"));
    expect(mutate).toHaveBeenCalledWith({
      habitId: base.id,
      date: today,
      value: 8,
    });
  });

  it("judges a Measurable Habit's day against its target", () => {
    const { rerender } = render(
      <HabitCard habit={{ ...measurable, entries: [entry(8)] }} />,
    );
    expect(screen.getByText("total")).toHaveTextContent("0 total");
    expect(
      screen
        .getByRole("button", { name: /log amount/i })
        .querySelector(".lucide-check"),
    ).toBeNull();

    rerender(<HabitCard habit={{ ...measurable, entries: [entry(12)] }} />);
    expect(screen.getByText("total")).toHaveTextContent("1 total");
    expect(
      screen
        .getByRole("button", { name: /log amount/i })
        .querySelector(".lucide-check"),
    ).not.toBeNull();
  });
});
