import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { ShortcutTipsRow } from "@/components/settings/ShortcutTipsRow";
import { useUiStore } from "@/lib/store/uiStore";

describe("ShortcutTipsRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({
      shortcutTipsEnabled: true,
    });
  });

  it("renders with the switch checked by default", () => {
    render(<ShortcutTipsRow />);

    expect(screen.getByText("Shortcut Tips")).toBeInTheDocument();
    expect(
      screen.getByText("Suggest keyboard shortcuts after repeated mouse use"),
    ).toBeInTheDocument();

    const toggle = screen.getByRole("switch", { name: /shortcut tips/i });
    expect(toggle).toBeChecked();
  });

  it("toggles shortcutTipsEnabled in store when clicked", () => {
    render(<ShortcutTipsRow />);

    const toggle = screen.getByRole("switch", { name: /shortcut tips/i });
    fireEvent.click(toggle);

    expect(useUiStore.getState().shortcutTipsEnabled).toBe(false);
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(useUiStore.getState().shortcutTipsEnabled).toBe(true);
    expect(toggle).toBeChecked();
  });
});
