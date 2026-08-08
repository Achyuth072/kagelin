import { describe, it, expect, beforeEach } from "vitest";
import { addDays, addWeeks, subDays } from "date-fns";
import { useCalendarStore } from "@/lib/calendar/store";

describe("next/prev day-count override", () => {
  beforeEach(() => {
    useCalendarStore.setState({
      currentDate: new Date(2026, 0, 15),
      view: "3day",
    });
  });

  it("next() with no argument falls through to the view's own day count", () => {
    const { currentDate } = useCalendarStore.getState();
    useCalendarStore.getState().next();
    expect(useCalendarStore.getState().currentDate).toEqual(
      addDays(currentDate, 3),
    );
  });

  it("next(days) advances by the given count instead of the view's default", () => {
    const { currentDate } = useCalendarStore.getState();
    useCalendarStore.getState().next(5);
    expect(useCalendarStore.getState().currentDate).toEqual(
      addDays(currentDate, 5),
    );
  });

  it("prev(days) retreats by the given count instead of the view's default", () => {
    const { currentDate } = useCalendarStore.getState();
    useCalendarStore.getState().prev(5);
    expect(useCalendarStore.getState().currentDate).toEqual(
      subDays(currentDate, 5),
    );
  });

  it("a days argument is ignored by views other than 3day", () => {
    useCalendarStore.setState({ view: "week" });
    const { currentDate } = useCalendarStore.getState();
    useCalendarStore.getState().next(5);
    expect(useCalendarStore.getState().currentDate).toEqual(
      addWeeks(currentDate, 1),
    );
  });
});
