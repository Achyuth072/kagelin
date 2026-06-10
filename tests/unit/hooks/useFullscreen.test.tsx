import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import React from "react";
import { useFullscreen } from "@/lib/hooks/useFullscreen";
import { FullscreenToggle } from "@/components/FullscreenToggle";

// ===== Hoisted mocks =====

const { mockSetIsFullscreen, mockSetIsPipActive, mockTrigger } = vi.hoisted(
  () => ({
    mockSetIsFullscreen: vi.fn(),
    mockSetIsPipActive: vi.fn(),
    mockTrigger: vi.fn(),
  }),
);

// ===== Mock control variables (modified per test) =====

let mockIsPhoneValue = false;
let mockIsFullscreenValue = false;

// ===== Fullscreen API state =====

let mockFullscreenElement: Element | null = null;
const requestFullscreenFn = vi.fn().mockResolvedValue(undefined);
const exitFullscreenFn = vi.fn().mockResolvedValue(undefined);
let fullscreenChangeHandler: (() => void) | null = null;

// ===== Module mocks =====

vi.mock("@/lib/store/uiStore", () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state: Record<string, unknown> = {
      isFullscreen: mockIsFullscreenValue,
      setIsFullscreen: mockSetIsFullscreen,
      isPipActive: false,
      setIsPipActive: mockSetIsPipActive,
    };
    return selector(state);
  },
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: mockTrigger,
    isPhone: mockIsPhoneValue,
    hapticsEnabled: true,
  }),
}));

vi.mock("framer-motion", () => {
  const MotionButton = React.forwardRef<
    HTMLButtonElement,
    React.ComponentProps<"button">
  >(({ children, onClick, className, ...props }, ref) => {
    return (
      <button ref={ref} onClick={onClick} className={className} {...props}>
        {children}
      </button>
    );
  });
  MotionButton.displayName = "MotionButton";

  return {
    motion: {
      button: MotionButton,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("lucide-react", () => ({
  Maximize2: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="maximize2-icon" {...props} />
  ),
  Minimize2: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="minimize2-icon" {...props} />
  ),
}));

// ===== Test suite =====

describe("useFullscreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFullscreenElement = null;
    mockIsPhoneValue = false;
    mockIsFullscreenValue = false;
    fullscreenChangeHandler = null;

    // Stub document properties
    Object.defineProperty(document, "fullscreenElement", {
      get: () => mockFullscreenElement,
      configurable: true,
    });
    Object.defineProperty(document, "fullscreenEnabled", {
      get: () => true,
      configurable: true,
    });
    document.documentElement.requestFullscreen = requestFullscreenFn;
    document.exitFullscreen = exitFullscreenFn;

    // Capture fullscreenchange listener
    document.addEventListener = vi.fn((event, handler) => {
      if (event === "fullscreenchange") {
        fullscreenChangeHandler = handler as () => void;
      }
    });
    document.removeEventListener = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Test 1: Desktop enterFullscreen calls requestFullscreen ---

  it("should call document.documentElement.requestFullscreen() on desktop", async () => {
    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      await result.current.enterFullscreen();
    });

    expect(requestFullscreenFn).toHaveBeenCalledTimes(1);
    expect(mockSetIsFullscreen).toHaveBeenCalledWith(true);
  });

  // --- Test 2: Mobile enterFullscreen attempts Fullscreen API (Android succeeds, iOS gracefully fails) ---

  it("should attempt Fullscreen API on mobile (Android succeeds, iOS gracefully fails to CSS layout)", async () => {
    mockIsPhoneValue = true;

    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      await result.current.enterFullscreen();
    });

    // Should attempt requestFullscreen on mobile (Android will succeed, iOS will throw/fail)
    expect(requestFullscreenFn).toHaveBeenCalledTimes(1);
    // Should still set isFullscreen to true for CSS layout (iOS fallback, Android enhancement)
    expect(mockSetIsFullscreen).toHaveBeenCalledWith(true);
  });

  // --- Test 3: Entering fullscreen no longer directly calls setIsPipActive ---

  it("should NOT call setIsPipActive directly (PiPProvider reactive effect handles dismissal)", async () => {
    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      await result.current.enterFullscreen();
    });

    // setIsPipActive(false) should NOT be called — PiPProvider handles it reactively
    expect(mockSetIsPipActive).not.toHaveBeenCalled();
    // setIsFullscreen(true) must be called
    expect(mockSetIsFullscreen).toHaveBeenCalledWith(true);
  });

  // --- Test 4: exitFullscreen calls document.exitFullscreen() on desktop ---

  it("should call document.exitFullscreen() on desktop exitFullscreen", async () => {
    const { result } = renderHook(() => useFullscreen());

    // Simulate fullscreen being active
    mockFullscreenElement = document.documentElement;

    await act(async () => {
      result.current.exitFullscreen();
    });

    expect(exitFullscreenFn).toHaveBeenCalledTimes(1);
    expect(mockSetIsFullscreen).toHaveBeenCalledWith(false);
  });

  // --- Test 5: exitFullscreen does NOT auto-restore PiP ---

  it("should NOT auto-restore PiP when exiting fullscreen (D-09)", async () => {
    const { result } = renderHook(() => useFullscreen());

    mockFullscreenElement = document.documentElement;

    await act(async () => {
      result.current.exitFullscreen();
    });

    // setIsPipActive should never have been called with true
    const trueCalls = mockSetIsPipActive.mock.calls.filter(
      (call) => call[0] === true,
    );
    expect(trueCalls.length).toBe(0);
  });

  // --- Test 6: fullscreenchange event updates isFullscreen ---

  it("should sync isFullscreen state via fullscreenchange event listener", async () => {
    renderHook(() => useFullscreen());
    expect(fullscreenChangeHandler).not.toBeNull();

    // Simulate entering fullscreen
    mockFullscreenElement = document.documentElement;
    await act(async () => {
      fullscreenChangeHandler!();
    });
    expect(mockSetIsFullscreen).toHaveBeenCalledWith(true);

    // Simulate exiting fullscreen
    mockFullscreenElement = null;
    await act(async () => {
      fullscreenChangeHandler!();
    });
    expect(mockSetIsFullscreen).toHaveBeenCalledWith(false);
  });

  // --- Test 6b: webkitfullscreenchange event updates isFullscreen (Safari) ---

  it("should sync isFullscreen state via webkitfullscreenchange event listener (Safari)", async () => {
    let webkitFullscreenChangeHandler: (() => void) | null = null;

    document.addEventListener = vi.fn((event, handler) => {
      if (event === "fullscreenchange") {
        fullscreenChangeHandler = handler as () => void;
      }
      if (event === "webkitfullscreenchange") {
        webkitFullscreenChangeHandler = handler as () => void;
      }
    });

    renderHook(() => useFullscreen());
    expect(webkitFullscreenChangeHandler).not.toBeNull();

    // Simulate entering fullscreen via webkit
    mockFullscreenElement = document.documentElement;
    await act(async () => {
      webkitFullscreenChangeHandler!();
    });
    expect(mockSetIsFullscreen).toHaveBeenCalledWith(true);

    // Simulate exiting fullscreen via webkit
    mockFullscreenElement = null;
    await act(async () => {
      webkitFullscreenChangeHandler!();
    });
    expect(mockSetIsFullscreen).toHaveBeenCalledWith(false);
  });

  // --- Test 6c: Safari vendor prefix fallback for requestFullscreen ---

  it("should use webkitRequestFullscreen when standard API is unavailable (Safari)", async () => {
    const webkitRequestFullscreenFn = vi.fn().mockResolvedValue(undefined);

    // Remove standard API
    {
      const el = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
      };
      delete el.requestFullscreen;
      el.webkitRequestFullscreen = webkitRequestFullscreenFn;
    }

    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      await result.current.enterFullscreen();
    });

    expect(webkitRequestFullscreenFn).toHaveBeenCalledTimes(1);
    expect(mockSetIsFullscreen).toHaveBeenCalledWith(true);
  });

  // --- Test 6d: Safari vendor prefix fallback for exitFullscreen ---

  it("should use webkitExitFullscreen when standard API is unavailable (Safari)", async () => {
    const webkitExitFullscreenFn = vi.fn().mockResolvedValue(undefined);

    // Simulate fullscreen being active
    mockFullscreenElement = document.documentElement;

    // Remove standard API
    {
      const doc = document as unknown as {
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
      };
      delete doc.exitFullscreen;
      doc.webkitExitFullscreen = webkitExitFullscreenFn;
    }

    const { result } = renderHook(() => useFullscreen());

    await act(async () => {
      result.current.exitFullscreen();
    });

    expect(webkitExitFullscreenFn).toHaveBeenCalledTimes(1);
    expect(mockSetIsFullscreen).toHaveBeenCalledWith(false);
  });
});

describe("FullscreenToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Test 7: Maximize2 when not fullscreen, Minimize2 when fullscreen ---

  it("should render Maximize2 icon when not fullscreen, Minimize2 when fullscreen", () => {
    // Given: not fullscreen
    mockIsFullscreenValue = false;

    const { unmount } = render(<FullscreenToggle />);
    expect(screen.getByTestId("maximize2-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("minimize2-icon")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Enter fullscreen",
    );
    unmount();

    // Given: fullscreen
    mockIsFullscreenValue = true;
    render(<FullscreenToggle />);
    expect(screen.getByTestId("minimize2-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("maximize2-icon")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Exit fullscreen",
    );
  });
});
