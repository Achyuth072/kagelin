import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SheetTabToggle } from "@/components/ui/SheetTabToggle";

describe("SheetTabToggle", () => {
  it("calls onValueChange with the clicked tab", () => {
    // Given: toggle currently on Edit
    const onValueChange = vi.fn();
    render(<SheetTabToggle value="edit" onValueChange={onValueChange} />);

    // When: Insights is clicked
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Insights" }));

    // Then: onValueChange fires with "insights"
    expect(onValueChange).toHaveBeenCalledWith("insights");
  });

  it("ignores Radix's empty-string deselect emission on re-click", () => {
    // Given: toggle currently on Insights
    const onValueChange = vi.fn();
    render(<SheetTabToggle value="insights" onValueChange={onValueChange} />);

    // When: the already-active Insights item is clicked again
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Insights" }));

    // Then: onValueChange is never called with an empty value
    expect(onValueChange).not.toHaveBeenCalledWith("");
  });

  it("renders icons and responsive label text for mobile", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <SheetTabToggle value="edit" onValueChange={onValueChange} />,
    );

    const editTab = screen.getByRole("tab", { name: "Edit" });
    const insightsTab = screen.getByRole("tab", { name: "Insights" });

    // Icons rendered
    expect(container.querySelectorAll("svg")).toHaveLength(2);

    // Labels have hidden sm:inline so they are icon-only on mobile
    const editLabel = editTab.querySelector("span");
    const insightsLabel = insightsTab.querySelector("span");
    expect(editLabel).toHaveClass("hidden", "sm:inline");
    expect(insightsLabel).toHaveClass("hidden", "sm:inline");
  });
});
