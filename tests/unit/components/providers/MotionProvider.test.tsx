import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import React from "react";
import { MotionProvider } from "@/components/providers/MotionProvider";
import * as m from "motion/react-m";

describe("MotionProvider", () => {
  it("renders children wrapped in MotionConfig and LazyMotion", () => {
    render(
      <MotionProvider>
        <div data-testid="child-node">Child Content</div>
      </MotionProvider>,
    );

    expect(screen.getByTestId("child-node")).toBeInTheDocument();
  });

  it("allows rendering m components without error under LazyMotion strict", () => {
    render(
      <MotionProvider>
        <m.div
          data-testid="m-div"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Animated under MotionProvider
        </m.div>
      </MotionProvider>,
    );

    expect(screen.getByTestId("m-div")).toBeInTheDocument();
  });
});
