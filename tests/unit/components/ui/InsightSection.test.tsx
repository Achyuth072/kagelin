import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InsightSection } from "@/components/ui/InsightSection";

describe("InsightSection", () => {
  it("renders title and children", () => {
    render(
      <InsightSection title="History">
        <div>Content</div>
      </InsightSection>,
    );
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders action aligned with title when action is provided", () => {
    render(
      <InsightSection
        title="History"
        action={<button type="button">Export</button>}
      >
        <div>Content</div>
      </InsightSection>,
    );
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
