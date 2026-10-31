import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

describe("Tabs Component", () => {
  it("renders with default card variant and switches tabs on click", () => {
    const onValueChange = vi.fn();
    render(
      <Tabs defaultValue="first" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="first">First</TabsTrigger>
          <TabsTrigger value="second">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="first">First Content</TabsContent>
        <TabsContent value="second">Second Content</TabsContent>
      </Tabs>,
    );

    const firstTab = screen.getByRole("tab", { name: "First" });
    const secondTab = screen.getByRole("tab", { name: "Second" });

    expect(firstTab).toHaveAttribute("data-state", "active");
    expect(secondTab).toHaveAttribute("data-state", "inactive");
    expect(screen.getByText("First Content")).toBeInTheDocument();

    // Card variant classes
    expect(firstTab.className).toContain("data-[state=active]:bg-card");

    // Click/mouseDown second tab
    fireEvent.mouseDown(secondTab);
    expect(onValueChange).toHaveBeenCalledWith("second");
  });

  it("supports brand variant inherited from TabsList", () => {
    render(
      <Tabs defaultValue="overview">
        <TabsList variant="brand">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const list = screen.getByRole("tablist");
    const overviewTab = screen.getByRole("tab", { name: "Overview" });

    expect(list.className).toContain("bg-secondary/10");
    expect(overviewTab.className).toContain("data-[state=active]:bg-brand");
  });

  it("supports size variants (sm, default, lg)", () => {
    const { rerender } = render(
      <Tabs defaultValue="tab1">
        <TabsList size="sm">
          <TabsTrigger value="tab1">Small</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const list = screen.getByRole("tablist");
    expect(list.className).toContain("h-9");

    let tab = screen.getByRole("tab", { name: "Small" });
    expect(tab.className).toContain("h-7");

    rerender(
      <Tabs defaultValue="tab1">
        <TabsList size="lg">
          <TabsTrigger value="tab1">Large</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    tab = screen.getByRole("tab", { name: "Large" });
    expect(tab.className).toContain("h-9");
  });

  it("applies brand text to active card tab when no icon is present", () => {
    render(
      <Tabs defaultValue="text-only">
        <TabsList>
          <TabsTrigger value="text-only">Text Only</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const tab = screen.getByRole("tab", { name: "Text Only" });
    expect(tab.className).toContain(
      "data-[state=active]:[&:not(:has(svg))]:text-brand",
    );
    expect(tab.className).toContain(
      "data-[state=active]:[&:has(svg)]:text-foreground",
    );
  });

  it("allows TabsTrigger to override the parent variant", () => {
    render(
      <Tabs defaultValue="custom">
        <TabsList variant="brand">
          <TabsTrigger value="custom" variant="card">
            Custom
          </TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const tab = screen.getByRole("tab", { name: "Custom" });
    expect(tab.className).toContain("data-[state=active]:bg-card");
    expect(tab.className).not.toContain("data-[state=active]:bg-brand");
  });

  it("includes standard icon size, shrink-0, and gap on TabsTrigger", () => {
    render(
      <Tabs defaultValue="with-icon">
        <TabsList>
          <TabsTrigger value="with-icon">
            <svg data-testid="test-icon" />
            <span>Icon Tab</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const tab = screen.getByRole("tab", { name: "Icon Tab" });
    expect(tab.className).toContain("gap-1.5");
    expect(tab.className).toContain("[&_svg]:size-3.5");
    expect(tab.className).toContain("[&_svg]:shrink-0");
  });
});
