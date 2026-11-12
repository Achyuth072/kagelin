import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { ProjectView } from "@/components/projects/ProjectView";

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
  }),
}));

describe("ProjectView", () => {
  it("renders create mode with PROJECT-NEW domain badge and Send CTA", () => {
    const onSubmit = vi.fn();
    render(
      <ProjectView
        mode="create"
        name="Personal Work"
        setName={vi.fn()}
        color="#4B6CB7"
        setColor={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const badge = screen.getByTestId("project-header-badge");
    expect(badge).toHaveTextContent("PROJECT-NEW");
    expect(
      screen.getByRole("button", { name: /create project/i }),
    ).toBeInTheDocument();
  });

  it("renders edit mode with formatted domain badge and Save CTA", () => {
    const onSubmit = vi.fn();
    const onArchive = vi.fn();
    const onDelete = vi.fn();

    render(
      <ProjectView
        mode="edit"
        projectId="project-a1b2c3d4"
        name="Personal Work"
        setName={vi.fn()}
        color="#4B6CB7"
        setColor={vi.fn()}
        onSubmit={onSubmit}
        onArchive={onArchive}
        onDelete={onDelete}
        isDirty={true}
      />,
    );

    const badge = screen.getByTestId("project-header-badge");
    expect(badge).toHaveTextContent("PROJECT-A1B2");
    expect(
      screen.getByRole("button", { name: /archive project/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete project/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save project/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /archive project/i }));
    expect(onArchive).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /delete project/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("submits on Enter key when title is filled", () => {
    const onSubmit = vi.fn();
    render(
      <ProjectView
        mode="create"
        name="Sprint Tasks"
        setName={vi.fn()}
        color="#4B6CB7"
        setColor={vi.fn()}
        onSubmit={onSubmit}
        isValid={true}
      />,
    );

    const input = screen.getByLabelText("Project Name");
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
