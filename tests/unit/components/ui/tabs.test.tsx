import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

describe("Tabs Component", () => {
  it("renders with default brand variant and switches tabs on click", () => {
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

    // Brand variant classes
    expect(firstTab.className).toContain("data-[state=active]:bg-brand");

    // Click/mouseDown second tab
    fireEvent.mouseDown(secondTab);
    expect(onValueChange).toHaveBeenCalledWith("second");
  });

  it("supports card variant inherited from TabsList", () => {
    render(
      <Tabs defaultValue="overview">
        <TabsList variant="card">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const list = screen.getByRole("tablist");
    const overviewTab = screen.getByRole("tab", { name: "Overview" });

    expect(list.className).toContain("bg-secondary/20");
    expect(overviewTab.className).toContain("data-[state=active]:bg-card");
    expect(overviewTab.className).toContain("data-[state=active]:shadow-xs");
  });

  it("supports size variants (sm, default, lg)", () => {
    const { rerender } = render(
      <Tabs defaultValue="tab1">
        <TabsList size="sm">
          <TabsTrigger value="tab1">Small</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

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
});
