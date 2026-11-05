/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SwipeableTaskContent } from "@/components/tasks/SwipeableTaskContent";
import React from "react";
import { useTransform } from "framer-motion";

// Mock framer-motion to capture props
vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    motion: {
      div: (() => {
        const Div = React.forwardRef(
          (
            {
              children,
              drag,
              dragElastic,
              dragConstraints,
              _initial,
              _animate,
              _exit,
              _transition,
              ...props
            }: any,
            ref: any,
          ) => {
            return (
              <div
                {...props}
                ref={ref}
                data-drag={drag}
                data-drag-elastic={
                  dragElastic ? JSON.stringify(dragElastic) : undefined
                }
                data-drag-constraints={
                  dragConstraints ? JSON.stringify(dragConstraints) : undefined
                }
              >
                {children}
              </div>
            );
          },
        );
        Div.displayName = "MotionDiv";
        return Div;
      })(),
    },
    useMotionValue: vi.fn(() => ({ get: () => 0, set: vi.fn(), on: vi.fn() })),
    useMotionValueEvent: vi.fn(),
    animate: vi.fn(),
    useTransform: vi.fn((_val, _from, _to) => ({ get: () => 0 })),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

describe("SwipeableTaskContent Drag Resistance & Thresholds", () => {
  const defaultProps = {
    children: <div>Task Content</div>,
    isDesktop: false,
    _isDragging: false,
    _viewMode: "list" as const,
    _isHandleActive: false,
    onSwipeLeft: vi.fn(),
    onSwipeRight: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have responsive dragElastic and direct tracking constraints", () => {
    render(<SwipeableTaskContent {...defaultProps} />);

    const dragContainer = document.querySelector('div[data-drag="x"]');
    const dragElasticRaw = dragContainer?.getAttribute("data-drag-elastic");
    const dragConstraintsRaw = dragContainer?.getAttribute(
      "data-drag-constraints",
    );
    const dragElastic = JSON.parse(dragElasticRaw!);
    const dragConstraints = JSON.parse(dragConstraintsRaw!);

    expect(dragElastic.left).toBe(0.25);
    expect(dragElastic.right).toBe(0.25);
    expect(dragConstraints.left).toBe(-100);
    expect(dragConstraints.right).toBe(100);
  });

  it("should have proper physical thresholds and visual commitment points (75px)", () => {
    render(<SwipeableTaskContent {...defaultProps} />);

    const transformCalls = (vi.mocked(useTransform).mock as { calls: any[][] })
      .calls;

    const backgroundTransformCall = transformCalls.find(
      (call: any[]) =>
        Array.isArray(call[1]) &&
        call[1].some((t: number) => Math.abs(t) === 75),
    );

    expect(backgroundTransformCall).toBeTruthy();
    const thresholds = backgroundTransformCall![1] as number[];
    const maxVisualThreshold = Math.max(...thresholds.map(Math.abs));

    expect(maxVisualThreshold).toBe(75);
  });

  it("should make swipe rigid (dragElastic=0) instead of disabling drag to prevent DnD event bubbling when isCompleted is true", () => {
    render(<SwipeableTaskContent {...defaultProps} isCompleted={true} />);

    const dragContainer = document.querySelector('div[data-drag="x"]');
    expect(dragContainer).toBeTruthy();

    const dragElasticRaw = dragContainer?.getAttribute("data-drag-elastic");
    const dragElastic = JSON.parse(dragElasticRaw!);

    expect(dragElastic.left).toBe(0);
    expect(dragElastic.right).toBe(0);
  });

  it("should render Check icon instead of Pencil icon for right swipe reveal", () => {
    const { container } = render(<SwipeableTaskContent {...defaultProps} />);
    expect(container.querySelector(".lucide-check")).toBeTruthy();
    expect(container.querySelector(".lucide-pencil")).toBeNull();
  });

  it("should render static children when suspended", () => {
    render(
      <SwipeableTaskContent {...defaultProps} suspended={true}>
        <div data-testid="suspended-child">Suspended Child</div>
      </SwipeableTaskContent>,
    );

    expect(screen.getByTestId("suspended-child")).toBeTruthy();
  });

  it("should apply touch-pan-y and select-none classes for mobile gesture hygiene", () => {
    const { container } = render(<SwipeableTaskContent {...defaultProps} />);
    const dragContainer = container.querySelector('div[data-drag="x"]');
    expect(dragContainer?.className).toContain("touch-pan-y");
    expect(dragContainer?.className).toContain("select-none");
  });

  it("should disable drag when isDesktop is true", () => {
    render(<SwipeableTaskContent {...defaultProps} isDesktop={true} />);
    const dragContainer = document.querySelector('div[data-drag="x"]');
    expect(dragContainer).toBeNull();
  });
});
