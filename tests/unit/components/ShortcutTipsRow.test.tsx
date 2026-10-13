import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ShortcutTipsRow } from "@/components/settings/ShortcutTipsRow";
import { useUiStore } from "@/lib/store/uiStore";

describe("ShortcutTipsRow", () => {
  beforeEach(() => {
    useUiStore.setState({ shortcutTipsEnabled: true });
  });

  it("renders with hidden md:flex classes so it is hidden on mobile screens", () => {
    const { container } = render(<ShortcutTipsRow />);
    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement).toHaveClass("hidden");
    expect(rootElement).toHaveClass("md:flex");
  });

  it("toggles shortcutTipsEnabled in uiStore when switched", () => {
    render(<ShortcutTipsRow />);
    const toggle = screen.getByRole("switch", { name: "Shortcut Tips" });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    expect(useUiStore.getState().shortcutTipsEnabled).toBe(false);

    fireEvent.click(toggle);
    expect(useUiStore.getState().shortcutTipsEnabled).toBe(true);
  });
});
