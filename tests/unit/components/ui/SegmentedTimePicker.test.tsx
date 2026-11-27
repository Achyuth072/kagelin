import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SegmentedTimePicker } from "@/components/ui/segmented-time-picker";
import React from "react";

// Mock Haptic hook
vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

describe("SegmentedTimePicker", () => {
  const onChange = vi.fn();
  const baseDate = new Date(2024, 0, 1, 10, 30); // 10:30 AM

  beforeEach(() => {
    onChange.mockClear();
  });

  it("should change hours when typing numeric keys on desktop", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const hourButton = screen.getByLabelText("Adjust Hours");
    hourButton.focus();

    // Test arrow key
    fireEvent.keyDown(hourButton, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledTimes(1);
    let newDate = onChange.mock.calls[0][0];
    expect(newDate.getHours()).toBe(11);

    // Test typing '3'
    fireEvent.keyDown(hourButton, { key: "3" });
    expect(onChange).toHaveBeenCalledTimes(2);
    newDate = onChange.mock.calls[1][0];
    expect(newDate.getHours()).toBe(3);
  });

  it("should change minutes when typing numeric keys on desktop", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const minuteButton = screen.getByLabelText("Adjust Minutes");
    minuteButton.focus();

    fireEvent.keyDown(minuteButton, { key: "4" });
    expect(onChange).toHaveBeenCalledTimes(1);
    let updatedDate = onChange.mock.calls[0][0];
    expect(updatedDate.getMinutes()).toBe(4);

    fireEvent.keyDown(minuteButton, { key: "5" });
    expect(onChange).toHaveBeenCalledTimes(2);
    updatedDate = onChange.mock.calls[1][0];
    expect(updatedDate.getMinutes()).toBe(45);
  });

  it("should handle wheel events on the hour button", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const hourButton = screen.getByLabelText("Adjust Hours");
    fireEvent.wheel(hourButton, { deltaY: -100 });

    expect(onChange).toHaveBeenCalled();
    const newDate = onChange.mock.calls[0][0];
    expect(newDate.getHours()).toBe(11);
  });

  it("should toggle AM/PM when typing 'a' or 'p'", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const ampmButton = screen.getByLabelText("Toggle AM PM");
    ampmButton.focus();
    fireEvent.keyDown(ampmButton, { key: "p" });

    expect(onChange).toHaveBeenCalled();
    const newDate = onChange.mock.calls[0][0];
    expect(newDate.getHours()).toBe(22);
  });

  it("should increment hours when pointer dragging up", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const hourButton = screen.getByLabelText("Adjust Hours");

    fireEvent.pointerDown(hourButton, { clientY: 200 });
    fireEvent.pointerUp(hourButton, { clientY: 150 }); // delta = 200 - 150 = 50 (> 20)

    expect(onChange).toHaveBeenCalled();
    const newDate = onChange.mock.calls[0][0];
    expect(newDate.getHours()).toBe(11);
  });

  it("exposes spinbutton ARIA attributes on Hours and Minutes", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const hours = screen.getByRole("spinbutton", { name: "Adjust Hours" });
    expect(hours).toHaveAttribute("aria-valuenow", "10");
    expect(hours).toHaveAttribute("aria-valuemin", "1");
    expect(hours).toHaveAttribute("aria-valuemax", "12");
    expect(hours).toHaveAttribute("aria-valuetext", "10 AM");

    const minutes = screen.getByRole("spinbutton", { name: "Adjust Minutes" });
    expect(minutes).toHaveAttribute("aria-valuenow", "30");
    expect(minutes).toHaveAttribute("aria-valuemin", "0");
    expect(minutes).toHaveAttribute("aria-valuemax", "59");
    expect(minutes).toHaveAttribute("aria-valuetext", "30 minutes");
  });

  it("auto-advances from Hours to Minutes on 2-9 in 12h mode and navigates with ArrowLeft/ArrowRight", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const hours = screen.getByRole("spinbutton", { name: "Adjust Hours" });
    const minutes = screen.getByRole("spinbutton", { name: "Adjust Minutes" });
    const ampm = screen.getByLabelText("Toggle AM PM");

    hours.focus();
    fireEvent.keyDown(hours, { key: "2" });
    expect(onChange.mock.calls[0][0].getHours()).toBe(2);
    expect(document.activeElement).toBe(minutes);

    fireEvent.keyDown(minutes, { key: "ArrowRight" });
    expect(document.activeElement).toBe(ampm);

    fireEvent.keyDown(ampm, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(minutes);

    fireEvent.keyDown(minutes, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(hours);
  });

  it("steps minutes by +/-15 on Shift+ArrowUp and Shift+ArrowDown", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const minutes = screen.getByRole("spinbutton", { name: "Adjust Minutes" });
    minutes.focus();

    fireEvent.keyDown(minutes, { key: "ArrowUp", shiftKey: true });
    expect(onChange.mock.calls[0][0].getMinutes()).toBe(45);

    fireEvent.keyDown(minutes, { key: "ArrowDown", shiftKey: true });
    expect(onChange.mock.calls[1][0].getMinutes()).toBe(15);
  });

  it("handles Backspace reset and moves focus back to Hours when Minutes is 00", () => {
    const zeroMinDate = new Date(2024, 0, 1, 10, 0);
    render(<SegmentedTimePicker value={zeroMinDate} onChange={onChange} />);

    const hours = screen.getByRole("spinbutton", { name: "Adjust Hours" });
    const minutes = screen.getByRole("spinbutton", { name: "Adjust Minutes" });

    minutes.focus();
    fireEvent.keyDown(minutes, { key: "Backspace" });
    expect(document.activeElement).toBe(hours);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(hours, { key: "Backspace" });
    expect(onChange.mock.calls[0][0].getHours()).toBe(0); // 12 AM
  });

  it("switches AM/PM when pressing 'a' or 'p' from any segment in 12h mode", () => {
    render(<SegmentedTimePicker value={baseDate} onChange={onChange} />);

    const hours = screen.getByRole("spinbutton", { name: "Adjust Hours" });
    hours.focus();
    fireEvent.keyDown(hours, { key: "p" });
    expect(onChange.mock.calls[0][0].getHours()).toBe(22);
  });

  it("rejects out-of-range second digits without silently mutating to fallback", () => {
    const date24 = new Date(2024, 0, 1, 14, 30);
    render(
      <SegmentedTimePicker
        value={date24}
        onChange={onChange}
        timeFormat="24h"
      />,
    );

    const hours = screen.getByRole("spinbutton", { name: "Adjust Hours" });
    hours.focus();
    fireEvent.keyDown(hours, { key: "2" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].getHours()).toBe(2);

    // Second digit '5' (25 > 23) must be rejected, not mutated to 05
    fireEvent.keyDown(hours, { key: "5" });
    expect(onChange).toHaveBeenCalledTimes(1);

    // Minutes: '6' commits 06, and in 24h mode focus stays; '9' after '5' -> 59 valid,
    // whereas '9' after '6' is rejected? Wait: '6' commits immediately, so test '5' then '9' (59) vs Android IME '99'
    const minutes = screen.getByRole("spinbutton", { name: "Adjust Minutes" });
    minutes.focus();
    fireEvent.keyDown(minutes, { key: "9" });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0].getMinutes()).toBe(9);
  });

  it("invokes onConfirm when pressing Enter", () => {
    const onConfirm = vi.fn();
    render(
      <SegmentedTimePicker
        value={baseDate}
        onChange={onChange}
        onConfirm={onConfirm}
      />,
    );

    const hours = screen.getByRole("spinbutton", { name: "Adjust Hours" });
    hours.focus();
    fireEvent.keyDown(hours, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("SegmentedTimePicker Modal Interaction", () => {
  it("should not let arrow keys bubble up to parent when focused on picker segments", () => {
    const onParentKeyDown = vi.fn();
    render(
      <div onKeyDown={onParentKeyDown}>
        <SegmentedTimePicker
          value={new Date(2024, 0, 1, 10, 30)}
          onChange={() => {}}
        />
      </div>,
    );

    const hourButton = screen.getByLabelText("Adjust Hours");
    hourButton.focus();
    fireEvent.keyDown(hourButton, { key: "ArrowUp", bubbles: true });

    expect(onParentKeyDown).not.toHaveBeenCalled();
  });
});
