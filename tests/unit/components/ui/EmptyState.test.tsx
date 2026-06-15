import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Layers } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders title and description without a CTA by default", () => {
    render(
      <EmptyState
        icon={Layers}
        title="No habits yet"
        description="Create your first habit to start tracking."
      />,
    );

    expect(screen.getByText("No habits yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first habit to start tracking."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the CTA when an action is provided", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Layers}
        title="No habits yet"
        description="Create your first habit to start tracking."
        action={{ label: "Create Habit", onClick }}
      />,
    );

    const button = screen.getByRole("button", { name: "Create Habit" });
    expect(button).toBeInTheDocument();
  });
});
